/**
 * La ficha de un niño: la rejilla de la semana, el colegio y la salud.
 *
 * Lo que más se mira es la rejilla semanal del registro, y su regla es la de
 * toda la app: un "no" apuntado, un día sin apuntar y un día que todavía no ha
 * llegado son tres cosas distintas y no pueden parecerse.
 */

import type { Clase, RegistroNino, RegistroTipo, SaludEvento, SaludTipo, Tarea } from './tipos';
import { caritasDe, definicion } from './apuntes';
import { diasEntre } from './fechas';

// ── rejilla de la semana ────────────────────────────────────────────────

/** Filas que siempre están; las demás aparecen solo si esa semana hay algo. */
export const FILAS_FIJAS: RegistroTipo[] = ['comida', 'cena', 'ducha', 'caca', 'lavado_pelo'];
const FILAS_OCASIONALES: RegistroTipo[] = ['medicacion', 'animo', 'observacion'];

export function filasRejilla(registros: RegistroNino[]): RegistroTipo[] {
  return [...FILAS_FIJAS, ...FILAS_OCASIONALES.filter((t) => registros.some((r) => r.tipo === t))];
}

export type EstadoCelda = 'si' | 'no' | 'sin_apuntar' | 'futuro';

export interface Celda {
  estado: EstadoCelda;
  marca: string;
  /** Algo de ese día está en el móvil sin subir. */
  pendiente: boolean;
}

const momento = (r: RegistroNino) => `${r.fecha} ${r.hora ?? ''} ${r.creado_en ?? ''}`;

/**
 * Qué se pinta en una casilla. Sí/no: un día con algún "sí" es sí; con solo
 * "no", es no. Comidas y ánimo: la carita del último apunte, en verde de 3 para
 * arriba. Medicación y notas: marcado si hay algo.
 */
export function celda(
  registros: (RegistroNino & { pendiente?: boolean })[], tipo: RegistroTipo, fecha: string, hoy: string,
): Celda {
  if (fecha > hoy) return { estado: 'futuro', marca: '', pendiente: false };
  const delDia = registros.filter((r) => r.tipo === tipo && r.fecha === fecha && !r.eliminado_en);
  if (!delDia.length) return { estado: 'sin_apuntar', marca: '·', pendiente: false };
  const pendiente = delDia.some((r) => r.pendiente);
  const detalle = definicion(tipo)?.detalle;

  if (detalle === 'escala') {
    const ultimo = [...delDia].sort((a, b) => momento(a).localeCompare(momento(b))).pop()!;
    const n = Number(ultimo.escala);
    const carita = caritasDe(tipo).find((c) => c.escala === n);
    if (!carita) return { estado: 'si', marca: '✓', pendiente };
    return { estado: n >= 3 ? 'si' : 'no', marca: carita.icono, pendiente };
  }
  if (detalle === 'texto') return { estado: 'si', marca: '✓', pendiente };

  const si = delDia.some((r) => r.valor === 'si');
  return { estado: si ? 'si' : 'no', marca: si ? '✓' : '✗', pendiente };
}

// ── colegio ─────────────────────────────────────────────────────────────

const EQUIPAMIENTO: Record<string, string> = { CH: 'chándal', PS: 'piscina' };

/** 'CH+PS' → 'chándal + piscina' */
export const nombreEquipamiento = (codigo?: string) =>
  String(codigo ?? '').split('+').map((c) => c.trim().toUpperCase()).filter(Boolean)
    .map((c) => EQUIPAMIENTO[c] ?? c).join(' + ');

export interface Franja {
  clave: string;
  hora: string;
  orden: number;
}

const claveFranja = (c: Clase) =>
  [c.hora_inicio, c.hora_fin].filter(Boolean).join('–') || `orden ${c.orden ?? ''}`;

/**
 * El horario como tabla: una fila por franja (hora u orden) y una columna por
 * día lectivo. Es fijo para todo el curso.
 */
export function tablaHorario(clases: Clase[]) {
  const franjas = new Map<string, Franja>();
  clases.forEach((c) => {
    const clave = claveFranja(c);
    if (!franjas.has(clave)) {
      franjas.set(clave, { clave, hora: [c.hora_inicio, c.hora_fin].filter(Boolean).join('–'), orden: Number(c.orden || 0) });
    }
  });
  const ordenadas = [...franjas.values()].sort((a, b) =>
    a.hora && b.hora ? a.hora.localeCompare(b.hora) : a.orden - b.orden);
  const clasesDe = (clave: string, dia: number) =>
    clases.filter((c) => Number(c.dia_semana) === dia && claveFranja(c) === clave);
  return { franjas: ordenadas, clasesDe };
}

export const hecha = (t: Tarea) => t.estado === 'hecha' || t.estado === 'entregada';

export interface TareasAgrupadas {
  atrasadas: Tarea[];
  hoy: Tarea[];
  semana: Tarea[];
  despues: Tarea[];
  hechas: Tarea[];
}

/** Vence hoy · esta semana · más adelante · hechas. Y antes, lo que se pasó de fecha. */
export function agruparTareas(tareas: Tarea[], hoy: string, finDeSemana: string): TareasAgrupadas {
  const vivas = tareas.filter((t) => !t.eliminado_en)
    .sort((a, b) => (a.fecha_entrega ?? '').localeCompare(b.fecha_entrega ?? ''));
  const pendientes = vivas.filter((t) => !hecha(t));
  return {
    atrasadas: pendientes.filter((t) => t.fecha_entrega < hoy),
    hoy: pendientes.filter((t) => t.fecha_entrega === hoy),
    semana: pendientes.filter((t) => t.fecha_entrega > hoy && t.fecha_entrega <= finDeSemana),
    despues: pendientes.filter((t) => t.fecha_entrega > finDeSemana),
    hechas: vivas.filter(hecha).reverse(),
  };
}

// ── salud ───────────────────────────────────────────────────────────────

export const ETIQUETA_SALUD: Record<SaludTipo, string> = {
  consulta: 'Consulta', urgencia: 'Urgencias', vacuna: 'Vacuna', sintoma: 'Síntoma',
  medicacion: 'Medicación', alergia: 'Alergia', revision: 'Revisión', dentista: 'Dentista', otro: 'Otro',
};

/** Las pautas de medicación vigentes, con los días que les quedan (null: sin fecha de fin). */
export function tratamientosActivos(eventos: SaludEvento[], hoy: string) {
  return eventos
    .filter((e) => !e.eliminado_en && e.tipo === 'medicacion' && e.desde && e.desde <= hoy && (!e.hasta || e.hasta >= hoy))
    .map((e) => ({ evento: e, quedan: e.hasta ? diasEntre(hoy, e.hasta) : null }));
}
