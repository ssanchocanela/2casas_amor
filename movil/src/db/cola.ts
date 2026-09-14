/**
 * La cola de escrituras pendientes, en SQLite local.
 *
 * Toda escritura entra aquí primero y se pinta al instante. Cuando hay red, la
 * cola se vacía de una vez con la acción 'sync' del backend, que responde por
 * operación: un apunte que falla se queda en la cola con su error y no bloquea
 * a los demás. Nada sale de la cola sin que el backend lo haya aceptado.
 *
 * La caché de lectura está en cache.ts; las dos comparten la base de base.ts.
 */

import { base } from './base';
import type { Credenciales, OperacionSync } from '../api/cliente';
import { ErrorApi, sincronizar } from '../api/cliente';

export type Accion = OperacionSync['accion'];

export interface Operacion {
  id_local: string;
  accion: Accion;
  tabla: string;
  registro_id: string;
  datos: Record<string, unknown>;
  creado_en: string;
  intentos: number;
  error: string | null;
}

export type OperacionNueva = Pick<Operacion, 'accion' | 'tabla' | 'registro_id' | 'datos'>;

interface FilaCola extends Omit<Operacion, 'datos'> { datos: string }

// ── avisos a la interfaz ────────────────────────────────────────────────

const oyentes = new Set<() => void>();

/** Llama a 'fn' cada vez que cambia la cola. Devuelve la función para dejar de oír. */
export function suscribir(fn: () => void) {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

const avisar = () => oyentes.forEach((fn) => fn());

// ── entrar y salir de la cola ───────────────────────────────────────────

let contador = 0;
const nuevoIdLocal = () =>
  `${Date.now().toString(36)}_${(contador++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Mete operaciones en la cola, todas o ninguna. Devuelve sus ids locales. */
export function encolar(ops: OperacionNueva[]): string[] {
  const db = base();
  const ids = ops.map(() => nuevoIdLocal());
  const ahora = new Date().toISOString();
  db.withTransactionSync(() => {
    ops.forEach((op, i) => {
      db.runSync(
        'INSERT INTO cola (id_local, accion, tabla, registro_id, datos, creado_en) VALUES (?, ?, ?, ?, ?, ?)',
        ids[i], op.accion, op.tabla, idActual(op.registro_id), JSON.stringify(op.datos), ahora,
      );
    });
  });
  avisar();
  return ids;
}

export function pendientes(): Operacion[] {
  return base()
    .getAllSync<FilaCola>('SELECT * FROM cola ORDER BY rowid')
    .map((f) => ({ ...f, datos: JSON.parse(f.datos) }));
}

/** Operaciones que han salido hacia el backend y esperan respuesta. */
const enviando = new Set<string>();

/**
 * Quita una operación que todavía no ha salido. Devuelve false si ya salió (o
 * ya no está): entonces deshacer exige encolar la operación contraria.
 */
export function retirar(idLocal: string): boolean {
  if (enviando.has(idLocal)) return false;
  const { changes } = base().runSync('DELETE FROM cola WHERE id_local = ?', idLocal);
  if (changes) avisar();
  return changes > 0;
}

/**
 * Si el backend guardó un alta con otro id (dos móviles sacaron el mismo), lo
 * que venga detrás sobre ese registro tiene que usar el id bueno.
 */
const renombrados = new Map<string, string>();
export const idActual = (id: string) => renombrados.get(id) ?? id;

// ── vaciar ──────────────────────────────────────────────────────────────

export interface ResultadoVaciado {
  enviadas: number;
  fallidas: number;
  sinConexion: boolean;
  error?: string;
}

let enCurso: Promise<ResultadoVaciado> | null = null;

/** Sube lo pendiente. Si ya se está subiendo, espera a esa misma subida. */
export function vaciar(cred: Credenciales): Promise<ResultadoVaciado> {
  if (!enCurso) enCurso = vaciarAhora(cred).finally(() => { enCurso = null; });
  return enCurso;
}

async function vaciarAhora(cred: Credenciales): Promise<ResultadoVaciado> {
  const ops = pendientes();
  if (!ops.length) return { enviadas: 0, fallidas: 0, sinConexion: false };

  ops.forEach((o) => enviando.add(o.id_local));
  try {
    const { resultados } = await sincronizar(cred, ops.map((o) => ({
      accion: o.accion, tabla: o.tabla, id: o.registro_id, datos: o.datos, idLocal: o.id_local,
    })));

    const db = base();
    let fallidas = 0;
    db.withTransactionSync(() => {
      resultados.forEach((r) => {
        const op = ops.find((o) => o.id_local === r.idLocal);
        if (!op) return;
        if (!r.ok) {
          fallidas++;
          db.runSync(
            'UPDATE cola SET intentos = intentos + 1, error = ? WHERE id_local = ?',
            r.error ?? 'error desconocido', op.id_local,
          );
          return;
        }
        db.runSync('DELETE FROM cola WHERE id_local = ?', op.id_local);
        const idGuardado = r.registro?.id;
        if (op.accion === 'create' && idGuardado && idGuardado !== op.registro_id) {
          renombrados.set(op.registro_id, idGuardado);
          db.runSync('UPDATE cola SET registro_id = ? WHERE registro_id = ?', idGuardado, op.registro_id);
        }
        confirmadas.push({ op: { ...op, registro_id: idGuardado ?? op.registro_id }, en: Date.now() });
      });
    });
    return { enviadas: resultados.length - fallidas, fallidas, sinConexion: false };
  } catch (e) {
    // Sin red o sin respuesta a tiempo: todo sigue en la cola. Si la petición sí
    // llegó, reenviarla no duplica nada: el backend reconoce el mismo id.
    if (e instanceof ErrorApi && (e.codigo === 'sin_conexion' || e.codigo === 'lento')) {
      return { enviadas: 0, fallidas: 0, sinConexion: true };
    }
    // Token, backend ocupado, implementación caducada…: todo sigue en la cola.
    return { enviadas: 0, fallidas: ops.length, sinConexion: false, error: (e as Error).message };
  } finally {
    ops.forEach((o) => enviando.delete(o.id_local));
    avisar();
  }
}

// ── pintar con lo pendiente ─────────────────────────────────────────────

export type ConMarca<T> = T & { pendiente?: boolean };

/**
 * Lo que el backend ya ha aceptado pero la última lectura aún no trae. Se sigue
 * pintando hasta la siguiente lectura, para que un apunte no parpadee al subir.
 */
let confirmadas: { op: Operacion; en: number }[] = [];

/** Olvida lo confirmado antes de 'antesDe': una lectura empezada después ya lo trae. */
export function olvidarConfirmadas(antesDe: number) {
  confirmadas = confirmadas.filter((c) => c.en >= antesDe);
}

/**
 * Lo que dice el backend, más lo recién subido y lo que aún está en la cola:
 * altas, cambios y deshechos. La cola manda, porque es lo más reciente.
 */
export function conPendientes<T extends { id: string }>(
  tabla: string, delBackend: T[], incluir: (fila: T) => boolean,
): ConMarca<T>[] {
  const filas = new Map<string, ConMarca<T>>();
  delBackend.forEach((f) => filas.set(f.id, f));

  const cambios = [
    ...confirmadas.map((c) => ({ op: c.op, pendiente: false })),
    ...pendientes().map((op) => ({ op, pendiente: true })),
  ].filter((c) => c.op.tabla === tabla);

  cambios.forEach(({ op, pendiente }) => {
    const id = op.registro_id;
    if (op.accion === 'create') {
      const fila = { ...(op.datos as T), id, pendiente };
      if (incluir(fila) && (pendiente || !filas.has(id))) filas.set(id, fila);
    } else if (op.accion === 'update' && filas.has(id)) {
      filas.set(id, { ...filas.get(id)!, ...(op.datos as Partial<T>), pendiente });
    } else if (op.accion === 'delete') {
      filas.delete(id);
    }
  });

  return [...filas.values()].filter((f) => !(f as { eliminado_en?: string }).eliminado_en);
}
