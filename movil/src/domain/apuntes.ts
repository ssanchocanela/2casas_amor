/**
 * Apuntar: qué se puede apuntar y cómo queda escrito.
 *
 * Dos caminos, igual que en la hoja, y es a propósito:
 *   · lo de la casa  → menu_casa: una fila por día y casa. La cena se cocina una
 *     vez para los dos; si ya hay apunte de hoy, se edita.
 *   · lo de cada niño → registro_nino: una fila por hecho.
 *
 * En caca, ducha y lavado de pelo el "no" se guarda igual que el "sí". Que no
 * haya fila significa "no se miró", que es una tercera cosa distinta.
 */

import type { MenuCasa, NinoId, PersonaId, RegistroNino, RegistroTipo } from './tipos';
import { diasEntre, letraDia, sumarDias } from './fechas';

export type ValorSiNo = 'si' | 'no';

/** Cómo se rellena cada tipo: dos botones, caritas o texto. */
export type Detalle = 'si_no' | 'escala' | 'texto';

export interface DefinicionApunte {
  tipo: RegistroTipo;
  etiqueta: string;
  icono: string;
  detalle: Detalle;
  /** Lo que casi siempre se hace a los dos a la vez: admite "los dos". */
  admiteLosDos: boolean;
}

/** La rejilla de "elegir qué", en su orden. */
export const APUNTES: DefinicionApunte[] = [
  { tipo: 'caca', etiqueta: 'Caca', icono: '💩', detalle: 'si_no', admiteLosDos: false },
  { tipo: 'ducha', etiqueta: 'Ducha', icono: '🚿', detalle: 'si_no', admiteLosDos: true },
  { tipo: 'lavado_pelo', etiqueta: 'Pelo', icono: '💇', detalle: 'si_no', admiteLosDos: true },
  { tipo: 'comida', etiqueta: 'Comió', icono: '🍲', detalle: 'escala', admiteLosDos: false },
  { tipo: 'cena', etiqueta: 'Cenó', icono: '🌙', detalle: 'escala', admiteLosDos: false },
  { tipo: 'medicacion', etiqueta: 'Medicación', icono: '💊', detalle: 'texto', admiteLosDos: false },
  { tipo: 'animo', etiqueta: 'Ánimo', icono: '🙂', detalle: 'escala', admiteLosDos: false },
  { tipo: 'observacion', etiqueta: 'Nota', icono: '✏️', detalle: 'texto', admiteLosDos: false },
];

export function definicion(tipo: RegistroTipo): DefinicionApunte | undefined {
  return APUNTES.find((a) => a.tipo === tipo);
}

/** Lo que se ve en "HOY SE HA APUNTADO": el camino de dos toques. */
export const TIPOS_RESUMEN: RegistroTipo[] = ['comida', 'cena', 'ducha', 'caca', 'lavado_pelo'];

export interface Carita { escala: number; icono: string; texto: string }

const CARITAS_COMIDA: Carita[] = [
  { escala: 1, icono: '😣', texto: 'nada' },
  { escala: 2, icono: '😕', texto: 'poco' },
  { escala: 3, icono: '😐', texto: 'normal' },
  { escala: 4, icono: '🙂', texto: 'bastante' },
  { escala: 5, icono: '😋', texto: 'todo' },
];

const CARITAS_ANIMO: Carita[] = [
  { escala: 1, icono: '😢', texto: 'muy mal' },
  { escala: 2, icono: '😟', texto: 'mal' },
  { escala: 3, icono: '😐', texto: 'normal' },
  { escala: 4, icono: '🙂', texto: 'bien' },
  { escala: 5, icono: '😄', texto: 'muy bien' },
];

export const caritasDe = (tipo: RegistroTipo) => (tipo === 'animo' ? CARITAS_ANIMO : CARITAS_COMIDA);

// ── identificadores ─────────────────────────────────────────────────────

export type TablaApunte = 'registro_nino' | 'menu_casa';

const PREFIJO: Record<TablaApunte, string> = { registro_nino: 'reg', menu_casa: 'men' };

/**
 * prefijo_AAAAMMDD_xxxx, como pide el esquema. Lo genera la app al apuntar, sin
 * red, para poder deshacer y reintentar sobre el mismo id. Si dos móviles sacan
 * el mismo, el backend guarda el segundo con otro id y lo devuelve.
 */
export function nuevoId(tabla: TablaApunte, fecha: string) {
  const azar = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${PREFIJO[tabla]}_${fecha.replace(/-/g, '')}_${azar}`;
}

// ── construir los apuntes ───────────────────────────────────────────────

/** Lo que se rellena solo: cuándo, en qué casa y quién. Corregible, nunca preguntado. */
export interface Circunstancias {
  fecha: string;
  hora: string;
  marca: string;
  casa_persona_id: PersonaId | '';
  /** Vacío: lo pone el backend a partir del token. */
  autor_id: PersonaId | '';
}

export interface DatoApunte {
  valor?: string;
  escala?: number;
  notas?: string;
}

/** Comprueba que el dato casa con el tipo. Devuelve el motivo si no vale. */
export function problemaDelDato(tipo: RegistroTipo, dato: DatoApunte): string | null {
  const def = definicion(tipo);
  if (!def) return 'Ese tipo de apunte no existe.';
  if (def.detalle === 'si_no' && dato.valor !== 'si' && dato.valor !== 'no') return 'Falta sí o no.';
  if (def.detalle === 'escala' && !(Number.isInteger(dato.escala) && dato.escala! >= 1 && dato.escala! <= 5)) {
    return 'Falta elegir de 1 a 5.';
  }
  if (def.detalle === 'texto' && !dato.valor?.trim()) return 'Falta escribir algo.';
  return null;
}

/** Una fila de registro_nino, lista para la cola. */
export function nuevoRegistro(
  c: Circunstancias, nino_id: NinoId, tipo: RegistroTipo, dato: DatoApunte,
): RegistroNino {
  const registro: RegistroNino = {
    id: nuevoId('registro_nino', c.fecha),
    creado_en: c.marca,
    fecha: c.fecha,
    hora: c.hora,
    nino_id,
    tipo,
    valor: dato.valor?.trim() ?? '',
    escala: dato.escala ?? '',
    casa_persona_id: c.casa_persona_id,
    notas: dato.notas?.trim() ?? '',
    autor_id: c.autor_id,
  };
  return registro;
}

/** "Los dos": un solo gesto, una fila por niño. */
export function nuevosRegistros(
  c: Circunstancias, ninos: NinoId[], tipo: RegistroTipo, dato: DatoApunte,
): RegistroNino[] {
  return ninos.map((n) => nuevoRegistro(c, n, tipo, dato));
}

export type CamposMenu = Pick<MenuCasa, 'comida' | 'cena' | 'fruta' | 'notas'>;

export function nuevoMenuCasa(c: Circunstancias, campos: CamposMenu): MenuCasa & { creado_en: string } {
  return {
    id: nuevoId('menu_casa', c.fecha),
    creado_en: c.marca,
    fecha: c.fecha,
    casa_persona_id: c.casa_persona_id,
    comida: campos.comida?.trim() ?? '',
    cena: campos.cena?.trim() ?? '',
    fruta: campos.fruta?.trim() ?? '',
    notas: campos.notas?.trim() ?? '',
    autor_id: c.autor_id,
  };
}

/** Solo lo que ha cambiado, para que el log diga exactamente qué se tocó. */
export function cambiosMenu(actual: MenuCasa, campos: CamposMenu): Partial<CamposMenu> {
  const cambios: Partial<CamposMenu> = {};
  (['comida', 'cena', 'fruta', 'notas'] as const).forEach((k) => {
    const nuevo = campos[k]?.trim() ?? '';
    if ((actual[k] ?? '') !== nuevo) cambios[k] = nuevo;
  });
  return cambios;
}

// ── leer lo apuntado ────────────────────────────────────────────────────

const vigentes = (registros: RegistroNino[]) => registros.filter((r) => !r.eliminado_en);

/** El último apunte de ese niño y tipo (el más reciente manda). */
export function ultimoApunte(registros: RegistroNino[], nino_id: NinoId, tipo: RegistroTipo) {
  return vigentes(registros)
    .filter((r) => r.nino_id === nino_id && r.tipo === tipo)
    .sort((a, b) => `${a.fecha} ${a.hora ?? ''} ${a.creado_en}`.localeCompare(`${b.fecha} ${b.hora ?? ''} ${b.creado_en}`))
    .pop();
}

export type EstadoDia = 'si' | 'no' | 'sin_apuntar';

export interface DiaDeSemana { fecha: string; letra: string; estado: EstadoDia }

/**
 * Los siete días que acaban en 'hoy', para un tipo sí/no. Un día con algún "sí"
 * es sí; con solo "no", es no; sin filas, sin apuntar. No se mezclan nunca.
 */
export function ultimaSemana(
  registros: RegistroNino[], nino_id: NinoId, tipo: RegistroTipo, hoy: string,
): DiaDeSemana[] {
  const suyos = vigentes(registros).filter((r) => r.nino_id === nino_id && r.tipo === tipo);
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(hoy, i - 6);
    const delDia = suyos.filter((r) => r.fecha === fecha);
    const estado: EstadoDia = delDia.some((r) => r.valor === 'si') ? 'si'
      : delDia.some((r) => r.valor === 'no') ? 'no' : 'sin_apuntar';
    return { fecha, letra: letraDia(fecha), estado };
  });
}

/**
 * El aviso ámbar: "Van 3 días sin apuntar que sí". Cuenta los días completos
 * desde el último "sí" hasta ayer. Null si no hay nada que avisar.
 */
export function avisoSinSi(semana: DiaDeSemana[], hoy: string): string | null {
  const ultimoSi = [...semana].reverse().find((d) => d.estado === 'si');
  if (!ultimoSi) {
    return semana.some((d) => d.estado !== 'sin_apuntar') ? 'Ningún sí apuntado en la última semana.' : null;
  }
  const dias = diasEntre(ultimoSi.fecha, hoy) - 1;
  return dias >= 2 ? `Van ${dias} días sin apuntar que sí.` : null;
}
