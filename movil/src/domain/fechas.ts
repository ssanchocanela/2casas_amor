/**
 * Fechas y horas del dominio: siempre texto, 'AAAA-MM-DD' y 'HH:MM', y siempre
 * en hora de Madrid, venga de donde venga el móvil (regla 7 de CLAUDE.md).
 */

export const ZONA = 'Europe/Madrid';

const p2 = (n: number) => String(n).padStart(2, '0');

/** { fecha: 'AAAA-MM-DD', hora: 'HH:MM', marca: 'AAAA-MM-DD HH:MM' } en Madrid. */
export function ahoraMadrid(d: Date = new Date()) {
  let fecha: string;
  let hora: string;
  try {
    const partes = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }).formatToParts(d).map((x) => [x.type, x.value]),
    );
    fecha = `${partes.year}-${partes.month}-${partes.day}`;
    hora = `${partes.hour}:${partes.minute}`;
  } catch {
    // Sin datos de zonas horarias en el motor: la hora del móvil, que en la
    // práctica ya es la de Madrid.
    fecha = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
    hora = `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  }
  return { fecha, hora, marca: `${fecha} ${hora}` };
}

export const hoyMadrid = () => ahoraMadrid().fecha;

/** Suma días a una fecha 'AAAA-MM-DD'. Mediodía para esquivar cambios de hora. */
export function sumarDias(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** Días enteros de 'desde' a 'hasta'. */
export function diasEntre(desde: string, hasta: string) {
  return Math.round(
    (new Date(hasta + 'T12:00:00').getTime() - new Date(desde + 'T12:00:00').getTime()) / 86400000,
  );
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** 'domingo 13' */
export function diaYNumero(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return `${DIAS[d.getDay()]} ${d.getDate()}`;
}

/** 'L' 'M' 'X' 'J' 'V' 'S' 'D' */
export function letraDia(iso: string) {
  return LETRAS[new Date(iso + 'T12:00:00').getDay()];
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** 'mié' */
export function diaCorto(iso: string) {
  return DIAS_CORTOS[new Date(iso + 'T12:00:00').getDay()];
}

/** '14/09/2026' */
export function fechaCorta(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
