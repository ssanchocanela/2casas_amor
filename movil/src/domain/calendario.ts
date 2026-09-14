/**
 * El calendario: meses, semanas y a quién le toca cada día.
 *
 * La custodia NO se calcula aquí: la da el backend a partir de Google Calendar.
 * Aquí solo se ordena en rejillas y se cuenta.
 */

import type { Custodia, DiaEscolar, DiasCustodia, EventoEscolar, NinoId, PersonaId, SaludTipo } from './tipos';
import { sumarDias } from './fechas';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
  'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const p2 = (n: number) => String(n).padStart(2, '0');

/** 'AAAA-MM' de una fecha 'AAAA-MM-DD'. */
export const mesDe = (fecha: string) => fecha.slice(0, 7);

/** 'Octubre' */
export const nombreMes = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1];

export function sumarMeses(mes: string, n: number) {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
  return `${Math.floor(total / 12)}-${p2((total % 12) + 1)}`;
}

/** El lunes de la semana de esa fecha. */
export function lunesDe(fecha: string) {
  const dia = (new Date(fecha + 'T12:00:00').getDay() + 6) % 7;
  return sumarDias(fecha, -dia);
}

/** Los siete días, de lunes a domingo, de la semana de esa fecha. */
export function semanaDe(fecha: string) {
  const lunes = lunesDe(fecha);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/** Las semanas completas que tocan el mes: lo que se pinta en la rejilla. */
export function rejillaMes(mes: string): string[][] {
  const primero = `${mes}-01`;
  const semanas: string[][] = [];
  let lunes = lunesDe(primero);
  do {
    semanas.push(semanaDe(lunes));
    lunes = sumarDias(lunes, 7);
  } while (mesDe(lunes) === mes);
  return semanas;
}

export function rangoRejilla(mes: string) {
  const semanas = rejillaMes(mes);
  return { desde: semanas[0][0], hasta: semanas[semanas.length - 1][6] };
}

/** Quién tiene a los niños ese día, sin repetir. Dos si están repartidos. */
export function quienesTienen(dia?: Record<NinoId, Custodia>): Custodia[] {
  const vistos = new Map<PersonaId, Custodia>();
  Object.values(dia ?? {}).forEach((c) => { if (!vistos.has(c.persona_id)) vistos.set(c.persona_id, c); });
  return [...vistos.values()];
}

export interface Recuento {
  persona_id: PersonaId;
  nombre: string;
  dias: number;
}

/** Días del mes con cada progenitor. Un día repartido cuenta para los dos. */
export function recuentoMes(dias: DiasCustodia, mes: string): Recuento[] {
  const cuenta = new Map<PersonaId, Recuento>();
  Object.keys(dias).filter((f) => mesDe(f) === mes).forEach((f) => {
    quienesTienen(dias[f]).forEach((c) => {
      const r = cuenta.get(c.persona_id) ?? { persona_id: c.persona_id, nombre: c.nombre, dias: 0 };
      r.dias++;
      cuenta.set(c.persona_id, r);
    });
  });
  return [...cuenta.values()].sort((a, b) => b.dias - a.dias);
}

/** Días de calendario_escolar sin clase: se pintan apagados. */
export const NO_LECTIVOS: DiaEscolar['tipo'][] = ['festivo', 'no_lectivo', 'vacaciones'];

/** Lo de salud que es una cita y merece estar en el calendario. */
export const CITAS_SALUD: SaludTipo[] = ['consulta', 'urgencia', 'vacuna', 'revision', 'dentista'];

/** Un evento de varios días (colonias) está en todos sus días. */
export const eventoEnDia = (e: EventoEscolar, fecha: string) =>
  !!e.fecha_inicio && e.fecha_inicio <= fecha && fecha <= (e.fecha_fin || e.fecha_inicio);
