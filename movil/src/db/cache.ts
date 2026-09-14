/**
 * La caché de lectura: lo último que dijo el backend, guardado en el móvil para
 * pintar sin esperar a la red.
 *
 *   · recuerdos: respuestas enteras por clave (la agenda de un día, los datos
 *     base) y preferencias pequeñas (el último niño elegido).
 *   · filas: filas sueltas de las pestañas con fecha, guardadas por rango. Lo
 *     que el backend deja de devolver en un rango —porque se borró— desaparece
 *     también de aquí: el borrado siempre gana.
 *
 * No es la fuente de verdad. Se puede vaciar entera y se vuelve a llenar sola.
 * Lo que aún no ha subido vive en la cola (cola.ts), no aquí.
 */

import { base } from './base';

// ── recuerdos ───────────────────────────────────────────────────────────

export function recordar(clave: string, valor: unknown) {
  base().runSync(
    'INSERT OR REPLACE INTO recuerdos (clave, valor, guardado_en) VALUES (?, ?, ?)',
    clave, JSON.stringify(valor), new Date().toISOString(),
  );
}

export function recuperar<T>(clave: string): T | null {
  const fila = base().getFirstSync<{ valor: string }>('SELECT valor FROM recuerdos WHERE clave = ?', clave);
  return fila ? (JSON.parse(fila.valor) as T) : null;
}

// ── filas ───────────────────────────────────────────────────────────────

/** Qué columna es la fecha de cada pestaña. La misma que usa 'list' en el backend. */
const COLUMNA_FECHA: Record<string, string> = {
  menu_casa: 'fecha', registro_nino: 'fecha', salud_eventos: 'fecha',
  salud_medidas: 'fecha', tareas: 'fecha_entrega', lecturas: 'fecha_inicio',
  eventos: 'fecha_inicio', menu_comedor: 'fecha', calendario_escolar: 'fecha',
};

export interface Rango {
  desde: string;
  hasta: string;
  /** Como en 'list': las filas de ese niño y las que no son de ningún niño. */
  nino?: string;
}

type Fila = { id: string } & Record<string, unknown>;

function filtro(tabla: string, rango: Rango) {
  const condiciones = ['tabla = ?', 'fecha >= ?', 'fecha <= ?'];
  const valores = [tabla, rango.desde, rango.hasta];
  if (rango.nino) {
    condiciones.push("(nino_id = ? OR nino_id = '')");
    valores.push(rango.nino);
  }
  return { donde: condiciones.join(' AND '), valores };
}

/** Sustituye lo guardado en ese rango por lo que acaba de decir el backend. */
export function guardarFilas(tabla: string, rango: Rango, filas: { id: string }[]) {
  const columna = COLUMNA_FECHA[tabla] ?? 'fecha';
  const db = base();
  const { donde, valores } = filtro(tabla, rango);
  db.withTransactionSync(() => {
    db.runSync(`DELETE FROM filas WHERE ${donde}`, ...valores);
    (filas as Fila[]).filter((f) => !f.eliminado_en).forEach((f) => {
      db.runSync(
        'INSERT OR REPLACE INTO filas (tabla, id, fecha, nino_id, datos) VALUES (?, ?, ?, ?, ?)',
        tabla, f.id, String(f[columna] ?? ''), String(f.nino_id ?? ''), JSON.stringify(f),
      );
    });
  });
}

export function leerFilas<T>(tabla: string, rango: Rango): T[] {
  const { donde, valores } = filtro(tabla, rango);
  return base()
    .getAllSync<{ datos: string }>(`SELECT datos FROM filas WHERE ${donde} ORDER BY fecha, id`, ...valores)
    .map((f) => JSON.parse(f.datos) as T);
}

/** Al desconectar el móvil: la caché era de esa hoja. La cola no se toca. */
export function olvidarCache() {
  base().execSync('DELETE FROM recuerdos; DELETE FROM filas;');
}
