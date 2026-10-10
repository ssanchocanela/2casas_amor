/**
 * Los tipos del dominio. Son el espejo del esquema de la hoja: cada campo se
 * llama EXACTAMENTE igual que su cabecera en Google Sheets.
 *
 * Esa correspondencia literal es intencionada. Es lo que permite abrir la hoja,
 * ver una columna rara y encontrarla en el código buscando por ese mismo nombre.
 * Si algún día cambia el esquema, se cambia aquí y en docs/02-hoja-de-calculo.md
 * en el mismo commit.
 */

export type PersonaId = string;
export type NinoId = string;

export interface Persona {
  id: PersonaId;
  nombre: string;
  rol: 'progenitor' | 'cuidador' | 'nino';
  email?: string;
  color_hex: string;
  activo?: string;
}

export interface Nino {
  id: NinoId;
  nombre: string;
  fecha_nacimiento?: string;
  curso?: string;
  grupo?: string;
  centro?: string;
  color_hex: string;
  alergias?: string;
  notas_medicas?: string;
  activo?: string;
}

export interface Clase {
  id: string;
  nino_id: NinoId;
  dia_semana: number | string;
  orden?: number | string;
  hora_inicio?: string;
  hora_fin?: string;
  asignatura: string;
  curso_escolar?: string;
  equipamiento?: string;
  aula?: string;
  profesor?: string;
}

export interface Extraescolar {
  id: string;
  nino_id: NinoId;
  dia_semana: number | string;
  actividad: string;
  curso_escolar?: string;
  hora_inicio?: string;
  hora_fin?: string;
  equipamiento?: string;
  lugar?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  notas?: string;
}

/** Quién tiene al niño ese día. Sale de Google Calendar, no de la hoja. */
export interface Custodia {
  persona_id: PersonaId;
  nombre: string;
  color_hex: string;
  titulo: string;
}

/**
 * A qué hora y por dónde se recoge. No es un dato guardado: lo calcula el
 * backend cruzando horario, extraescolares y calendario escolar.
 */
export interface Recogida {
  hay: boolean;
  hora?: string | null;
  hora_hasta?: string;
  motivo: 'extraescolar' | 'salida_ordinaria' | 'sin_horario' |
          'fin_de_semana' | 'festivo' | 'no_lectivo' | 'vacaciones';
  actividad?: string;
  lugar?: string;
  notas?: string;
  descripcion?: string;
}

/** Qué hay que meter en la mochila, y por qué. */
export interface Equipamiento {
  codigo: string;        // CH · PS
  nombre: string;        // chándal · material de piscina
  porque: string[];      // las asignaturas o actividades que lo piden
}

export interface NinoDelDia {
  nino_id: NinoId;
  nombre: string;
  color_hex: string;
  custodia: Custodia | null;
  clases: Clase[];
  recogida: Recogida;
  equipamiento_manana: Equipamiento[];
}

export interface MenuComedor {
  id: string;
  fecha: string;
  primero?: string;
  segundo?: string;
  postre?: string;
  alergenos?: string;
}

export interface MenuCasa {
  id: string;
  fecha: string;
  casa_persona_id: PersonaId;
  comida?: string;
  cena?: string;
  fruta?: string;
  notas?: string;
  autor_id: PersonaId;
}

export type RegistroTipo =
  | 'desayuno' | 'comida' | 'merienda' | 'cena'
  | 'caca' | 'pipi' | 'ducha' | 'bano' | 'lavado_pelo'
  | 'medicacion' | 'animo' | 'sueno' | 'observacion';

export interface RegistroNino {
  id: string;
  creado_en: string;
  fecha: string;
  hora?: string;
  nino_id: NinoId;
  tipo: RegistroTipo;
  /** 'si' o 'no' en caca, ducha y lavado de pelo. Texto libre en el resto. */
  valor?: string;
  /** 1 a 5. En comidas: 1 nada, 5 todo. Vacío si no aplica. */
  escala?: number | string;
  casa_persona_id?: PersonaId;
  notas?: string;
  autor_id: PersonaId;
  eliminado_en?: string;
}

export interface Tarea {
  id: string;
  creado_en?: string;
  nino_id: NinoId;
  asignatura?: string;
  titulo: string;
  descripcion?: string;
  tipo: 'deber' | 'examen' | 'trabajo' | 'proyecto' | 'entrega' | 'lectura';
  fecha_asignada?: string;
  fecha_entrega: string;
  estado: 'pendiente' | 'en_curso' | 'hecha' | 'entregada';
  prioridad?: 'normal' | 'alta';
  completada_en?: string;
  autor_id?: PersonaId;
  eliminado_en?: string;
}

export interface EventoEscolar {
  id: string;
  nino_id?: NinoId;
  titulo: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin?: string;
  hora_inicio?: string;
  hora_fin?: string;
  lugar?: string;
  coste?: number | string;
  pagado_por?: PersonaId;
  notas?: string;
  /** Lo rellena la app al volcar el evento a Google Calendar. */
  calendar_event_id?: string;
  autor_id?: PersonaId;
  eliminado_en?: string;
}

export interface TratamientoActivo {
  id: string;
  nino_id: NinoId;
  titulo: string;
  tratamiento?: string;
  desde?: string;
  hasta?: string;
}

export interface DiaEscolar {
  id: string;
  fecha: string;
  /** 'centro' o un nino_id. */
  ambito?: string;
  tipo: 'festivo' | 'no_lectivo' | 'vacaciones' | 'jornada_reducida' | 'evento';
  descripcion?: string;
}

export type SaludTipo =
  | 'consulta' | 'urgencia' | 'vacuna' | 'sintoma' | 'medicacion'
  | 'alergia' | 'revision' | 'dentista' | 'otro';

export interface SaludEvento {
  id: string;
  creado_en?: string;
  fecha: string;
  nino_id: NinoId;
  tipo: SaludTipo;
  titulo: string;
  descripcion?: string;
  profesional?: string;
  centro?: string;
  diagnostico?: string;
  tratamiento?: string;
  desde?: string;
  hasta?: string;
  adjunto_url?: string;
  autor_id?: PersonaId;
  eliminado_en?: string;
}

/** La custodia por día, como la devuelve el backend: { 'AAAA-MM-DD': { nino_id: Custodia } }. */
export type DiasCustodia = Record<string, Record<NinoId, Custodia>>;

/** Entrada, salida y puerta de cada niño. Fijo para el curso. */
export interface HorarioCentro {
  id: string;
  nino_id: NinoId;
  curso_escolar?: string;
  entrada_desde?: string;
  entrada_hasta?: string;
  salida_desde?: string;
  salida_hasta?: string;
  puerta?: string;
  notas?: string;
  activo?: string;
}

export interface Lectura {
  id: string;
  nino_id: NinoId;
  titulo: string;
  /** El autor del libro. Quien lo apuntó va en autor_id. */
  autor?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  paginas_totales?: number | string;
  paginas_leidas?: number | string;
  minutos?: number | string;
  valoracion?: number | string;
  comentario?: string;
  autor_id?: PersonaId;
  eliminado_en?: string;
}

export interface SaludMedida {
  id: string;
  fecha: string;
  nino_id: NinoId;
  peso_kg?: number | string;
  talla_cm?: number | string;
  notas?: string;
  autor_id?: PersonaId;
}

// ── respuestas de la API ──────────────────────────────────────────────

export interface RespuestaBootstrap {
  ok: true;
  version_api: number;
  version_esquema: string | null;
  yo: PersonaId;
  config: Record<string, string>;
  listas: Record<string, string[]>;
  personas: Persona[];
  ninos: Nino[];
  horario_centro: HorarioCentro[];
  horario_lectivo: Clase[];
  extraescolares: Extraescolar[];
}

export interface RespuestaAgenda {
  ok: true;
  fecha: string;
  dia_semana: number;
  escolar: DiaEscolar | null;
  ninos: NinoDelDia[];
  proximo_cambio: { fecha: string; custodia: Record<NinoId, Custodia> } | null;
  menu_comedor: MenuComedor | null;
  menu_casa: MenuCasa[];
  registro: RegistroNino[];
  tareas_vencen: Tarea[];
  eventos: EventoEscolar[];
  tratamientos_activos: TratamientoActivo[];
}

export interface RespuestaLista<T> {
  ok: true;
  tabla: string;
  total: number;
  filas: T[];
}

export interface RespuestaCustodia {
  ok: true;
  desde: string;
  hasta: string;
  dias: DiasCustodia;
}

/** Un mes con imagen del menú del comedor en la carpeta de Drive. */
export interface MenuDisponible {
  mes: string;
  nombre: string;
  actualizado: string;
}

export interface RespuestaMenusComedor {
  ok: true;
  menus: MenuDisponible[];
}

export interface RespuestaMenuImagen {
  ok: true;
  mes: string;
  hay: boolean;
  /** El móvil ya tenía esta versión: no viene la imagen. */
  sin_cambios?: boolean;
  nombre?: string;
  tipo?: string;
  actualizado?: string;
  base64?: string;
}

export interface RespuestaError {
  ok: false;
  error: string;
  mensaje?: string;
  detalle?: string;
}
