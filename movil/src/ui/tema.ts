/**
 * Los colores y medidas de la app, en un solo sitio.
 *
 * Los colores de cada niño y de cada progenitor NO están aquí: vienen de las
 * pestañas 'ninos' y 'personas' de la hoja, para poder cambiarlos sin tocar
 * el código.
 */

export const color = {
  fondo: '#F7F7F5',
  tarjeta: '#FFFFFF',
  borde: '#E3E3DE',
  texto: '#1C1C1A',
  textoSuave: '#6B6B66',
  textoTenue: '#9A9A94',
  acento: '#1B5E20',
  aviso: '#B45309',
  error: '#B3261E',
  pendiente: '#9A9A94',
};

/** Los tres estados de un apunte, que no deben parecerse: sí, no y sin apuntar. */
export const tonoApunte = {
  si: { fondo: '#DCE8DA', texto: color.acento },
  no: { fondo: '#F3E3D6', texto: color.aviso },
  sin_apuntar: { fondo: '#EFEEEA', texto: color.textoTenue },
};

export const espacio = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };

export const radio = { s: 8, m: 12, l: 16 };

/**
 * Un color de la hoja aclarado hacia el blanco, para usarlo de fondo. 'cuanto'
 * va de 0 (blanco) a 1 (el color tal cual).
 */
export function tintar(hex: string | undefined, cuanto: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return color.borde;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(255 + (c - 255) * cuanto));
  return `rgb(${r}, ${g}, ${b})`;
}

export const letra = {
  titulo: { fontSize: 26, fontWeight: '700' as const, color: color.texto },
  seccion: {
    fontSize: 12, fontWeight: '700' as const, color: color.textoSuave,
    letterSpacing: 0.8,
  },
  cuerpo: { fontSize: 16, color: color.texto },
  dato: { fontSize: 18, fontWeight: '600' as const, color: color.texto },
  suave: { fontSize: 14, color: color.textoSuave },
  tenue: { fontSize: 13, color: color.textoTenue },
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 'martes 6 de octubre' */
export function fechaLarga(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function hoyISO() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function sumarDias(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
