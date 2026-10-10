/**
 * LAS FICHAS: tareas, lecturas y eventos.
 *
 * Son las tres pestañas que hasta ahora solo se podían escribir abriendo la
 * hoja de cálculo. Aquí se declaran sus campos una vez —literalmente los de
 * `docs/02-hoja-de-calculo.md`, con sus listas cerradas— y de esa declaración
 * salen el formulario, la validación y lo que se manda al backend.
 *
 * Todo viaja como texto, que es como vive en la hoja. Lo que no se rellena no
 * se manda: `creado_en` y `autor_id` los pone el backend con el token.
 */

import type { EventoEscolar, Lectura, SaludEvento, SaludMedida, Tarea } from './tipos';
import { hoyMadrid, sumarDias } from './fechas';

export type TablaFicha = 'tareas' | 'lecturas' | 'eventos' | 'salud_eventos' | 'salud_medidas';

export type FilaFicha = Tarea | Lectura | EventoEscolar | SaludEvento | SaludMedida;

export type Valores = Record<string, string>;

export type ClaseCampo =
  | 'texto' | 'parrafo' | 'fecha' | 'hora' | 'numero' | 'decimal' | 'opciones' | 'estrellas' | 'nino';

export interface CampoFicha {
  /** La cabecera de la hoja, tal cual. */
  campo: string;
  etiqueta: string;
  clase: ClaseCampo;
  opciones?: { valor: string; texto: string }[];
  ayuda?: string;
  requerido?: boolean;
  /** Dos campos cortos en la misma línea (páginas leídas y totales, las horas). */
  media?: boolean;
  /** Una advertencia debajo del campo, según lo que haya puesto. */
  aviso?: (v: Valores) => string | null;
}

export interface DefinicionFicha {
  tabla: TablaFicha;
  /** 'la tarea', para los textos. */
  nombre: string;
  nueva: string;
  prefijo: string;
  /** La columna por la que se busca en el rango de fechas. */
  columnaFecha: string;
  campos: CampoFicha[];
  /** Columnas que no se preguntan pero sí se escriben (ver `normalizar`). */
  ocultos?: string[];
}

const TIPOS_TAREA = [
  { valor: 'deber', texto: 'Deberes' },
  { valor: 'examen', texto: 'Examen' },
  { valor: 'trabajo', texto: 'Trabajo' },
  { valor: 'proyecto', texto: 'Proyecto' },
  { valor: 'entrega', texto: 'Entrega' },
  { valor: 'lectura', texto: 'Lectura' },
];

const ESTADOS_TAREA = [
  { valor: 'pendiente', texto: 'Pendiente' },
  { valor: 'en_curso', texto: 'En curso' },
  { valor: 'hecha', texto: 'Hecha' },
  { valor: 'entregada', texto: 'Entregada' },
];

const TIPOS_EVENTO = [
  { valor: 'colonias', texto: 'Colonias' },
  { valor: 'excursion', texto: 'Excursión' },
  { valor: 'extraescolar', texto: 'Extraescolar' },
  { valor: 'reunion_tutor', texto: 'Reunión' },
  { valor: 'cumple', texto: 'Cumple' },
  { valor: 'otro', texto: 'Otro' },
];

const TIPOS_SALUD = [
  { valor: 'consulta', texto: 'Consulta' },
  { valor: 'urgencia', texto: 'Urgencias' },
  { valor: 'vacuna', texto: 'Vacuna' },
  { valor: 'sintoma', texto: 'Síntoma' },
  { valor: 'medicacion', texto: 'Medicación' },
  { valor: 'alergia', texto: 'Alergia' },
  { valor: 'revision', texto: 'Revisión' },
  { valor: 'dentista', texto: 'Dentista' },
  { valor: 'otro', texto: 'Otro' },
];

export const FICHAS: Record<TablaFicha, DefinicionFicha> = {
  tareas: {
    tabla: 'tareas',
    nombre: 'la tarea',
    nueva: 'Nueva tarea',
    prefijo: 'tar',
    columnaFecha: 'fecha_entrega',
    ocultos: ['completada_en'],
    campos: [
      { campo: 'nino_id', etiqueta: 'De quién', clase: 'nino' },
      { campo: 'titulo', etiqueta: 'Qué hay que hacer', clase: 'texto', requerido: true, ayuda: 'Ficha de sumas, página 24…' },
      { campo: 'asignatura', etiqueta: 'Asignatura', clase: 'texto', ayuda: 'Matemáticas, Català…' },
      { campo: 'tipo', etiqueta: 'Tipo', clase: 'opciones', opciones: TIPOS_TAREA },
      { campo: 'fecha_entrega', etiqueta: 'Para cuándo', clase: 'fecha', requerido: true },
      { campo: 'estado', etiqueta: 'Estado', clase: 'opciones', opciones: ESTADOS_TAREA },
      { campo: 'prioridad', etiqueta: 'Prioridad', clase: 'opciones', opciones: [{ valor: 'normal', texto: 'Normal' }, { valor: 'alta', texto: 'Alta' }] },
      { campo: 'descripcion', etiqueta: 'Detalle', clase: 'parrafo' },
    ],
  },
  lecturas: {
    tabla: 'lecturas',
    nombre: 'la lectura',
    nueva: 'Nueva lectura',
    prefijo: 'lec',
    columnaFecha: 'fecha_inicio',
    campos: [
      { campo: 'nino_id', etiqueta: 'De quién', clase: 'nino' },
      { campo: 'titulo', etiqueta: 'Libro', clase: 'texto', requerido: true },
      { campo: 'autor', etiqueta: 'De quién es el libro', clase: 'texto', ayuda: 'El autor' },
      { campo: 'fecha_inicio', etiqueta: 'Empezado', clase: 'fecha', requerido: true },
      { campo: 'fecha_fin', etiqueta: 'Terminado', clase: 'fecha' },
      { campo: 'paginas_leidas', etiqueta: 'Páginas leídas', clase: 'numero', media: true },
      { campo: 'paginas_totales', etiqueta: 'De cuántas', clase: 'numero', media: true },
      { campo: 'valoracion', etiqueta: 'Le ha gustado', clase: 'estrellas' },
      { campo: 'comentario', etiqueta: 'Comentario', clase: 'parrafo' },
    ],
  },
  eventos: {
    tabla: 'eventos',
    nombre: 'el evento',
    nueva: 'Nuevo evento',
    prefijo: 'eve',
    columnaFecha: 'fecha_inicio',
    campos: [
      { campo: 'nino_id', etiqueta: 'De quién', clase: 'nino' },
      { campo: 'titulo', etiqueta: 'Qué es', clase: 'texto', requerido: true, ayuda: 'Excursión al museo…' },
      { campo: 'tipo', etiqueta: 'Tipo', clase: 'opciones', opciones: TIPOS_EVENTO },
      { campo: 'fecha_inicio', etiqueta: 'Cuándo', clase: 'fecha', requerido: true },
      { campo: 'fecha_fin', etiqueta: 'Hasta', clase: 'fecha' },
      { campo: 'hora_inicio', etiqueta: 'Hora', clase: 'hora', media: true },
      { campo: 'hora_fin', etiqueta: 'Hasta las', clase: 'hora', media: true },
      { campo: 'lugar', etiqueta: 'Dónde', clase: 'texto' },
      { campo: 'notas', etiqueta: 'Qué hay que llevar', clase: 'parrafo' },
    ],
  },
  salud_eventos: {
    tabla: 'salud_eventos',
    nombre: 'el apunte de salud',
    nueva: 'Nuevo apunte de salud',
    prefijo: 'sal',
    columnaFecha: 'fecha',
    campos: [
      { campo: 'nino_id', etiqueta: 'De quién', clase: 'nino' },
      { campo: 'fecha', etiqueta: 'Cuándo', clase: 'fecha', requerido: true },
      { campo: 'tipo', etiqueta: 'Qué fue', clase: 'opciones', opciones: TIPOS_SALUD },
      { campo: 'titulo', etiqueta: 'En una línea', clase: 'texto', requerido: true, ayuda: 'Revisión anual, fiebre…' },
      { campo: 'descripcion', etiqueta: 'Qué pasó', clase: 'parrafo' },
      { campo: 'profesional', etiqueta: 'Quién le vio', clase: 'texto', media: true },
      { campo: 'centro', etiqueta: 'Dónde', clase: 'texto', media: true },
      { campo: 'diagnostico', etiqueta: 'Diagnóstico', clase: 'texto' },
      // La pauta: con 'desde' y 'hasta' el tratamiento sale como activo en la
      // ficha del niño y se ofrece al apuntar medicación.
      {
        campo: 'tratamiento',
        etiqueta: 'Pauta',
        clase: 'texto',
        ayuda: 'Dalsy 5 ml cada 8 h',
        // La misma regla que el backend: solo las de tipo 'medicacion' salen
        // como tratamiento activo. Decirlo aquí evita apuntar una pauta que
        // luego no aparece en ningún sitio.
        aviso: (v) => (v.tratamiento?.trim() && v.tipo !== 'medicacion'
          ? 'Para que salga como tratamiento activo y se ofrezca al apuntar medicación, el tipo tiene que ser Medicación.'
          : null),
      },
      { campo: 'desde', etiqueta: 'La pauta, desde', clase: 'fecha' },
      { campo: 'hasta', etiqueta: 'Hasta', clase: 'fecha' },
    ],
  },
  salud_medidas: {
    tabla: 'salud_medidas',
    nombre: 'la medida',
    nueva: 'Nueva medida',
    prefijo: 'med',
    columnaFecha: 'fecha',
    campos: [
      { campo: 'nino_id', etiqueta: 'De quién', clase: 'nino' },
      { campo: 'fecha', etiqueta: 'Cuándo', clase: 'fecha', requerido: true },
      { campo: 'peso_kg', etiqueta: 'Peso (kg)', clase: 'decimal', media: true },
      { campo: 'talla_cm', etiqueta: 'Talla (cm)', clase: 'decimal', media: true },
      { campo: 'notas', etiqueta: 'Notas', clase: 'parrafo' },
    ],
  },
};

/** prefijo_AAAAMMDD_xxxx, como pide el esquema. */
export function nuevoIdFicha(tabla: TablaFicha, fecha: string) {
  const azar = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${FICHAS[tabla].prefijo}_${fecha.replace(/-/g, '')}_${azar}`;
}

/** Una ficha en blanco: lo de siempre ya puesto, para que haya poco que tocar. */
export function valoresNuevos(tabla: TablaFicha, nino_id: string): Valores {
  const hoy = hoyMadrid();
  const comun = { nino_id };
  if (tabla === 'tareas') {
    // Los deberes casi siempre son para el día siguiente.
    return { ...comun, titulo: '', asignatura: '', tipo: 'deber', fecha_entrega: sumarDias(hoy, 1), estado: 'pendiente', prioridad: 'normal', descripcion: '' };
  }
  if (tabla === 'lecturas') {
    return { ...comun, titulo: '', autor: '', fecha_inicio: hoy, fecha_fin: '', paginas_leidas: '', paginas_totales: '', valoracion: '', comentario: '' };
  }
  if (tabla === 'salud_eventos') {
    return {
      ...comun, fecha: hoy, tipo: 'consulta', titulo: '', descripcion: '',
      profesional: '', centro: '', diagnostico: '', tratamiento: '', desde: '', hasta: '',
    };
  }
  if (tabla === 'salud_medidas') {
    return { ...comun, fecha: hoy, peso_kg: '', talla_cm: '', notas: '' };
  }
  return { ...comun, titulo: '', tipo: 'otro', fecha_inicio: hoy, fecha_fin: '', hora_inicio: '', hora_fin: '', lugar: '', notas: '' };
}

/** Una fila de la hoja, como texto editable. */
export function valoresDe(tabla: TablaFicha, fila: FilaFicha): Valores {
  const v: Valores = {};
  const leer = (campo: string) => {
    const dato = (fila as unknown as Record<string, unknown>)[campo];
    v[campo] = dato === undefined || dato === null ? '' : String(dato);
  };
  FICHAS[tabla].campos.forEach((c) => leer(c.campo));
  (FICHAS[tabla].ocultos ?? []).forEach(leer);
  return v;
}

/**
 * Lo que de verdad ha cambiado. Mandar solo eso evita pisar lo que haya
 * tocado el otro en la hoja mientras tanto.
 */
export function cambiosFicha(antes: Valores, ahora: Valores): Valores {
  const cambios: Valores = {};
  Object.keys(ahora).forEach((k) => {
    if ((antes[k] ?? '') !== (ahora[k] ?? '')) cambios[k] = ahora[k];
  });
  return cambios;
}

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ES_HORA = /^\d{1,2}:\d{2}$/;
const ES_DECIMAL = /^\d{1,3}([.,]\d{1,2})?$/;

/** El motivo por el que no se puede guardar, en español, o null si se puede. */
export function problemaFicha(tabla: TablaFicha, v: Valores): string | null {
  for (const c of FICHAS[tabla].campos) {
    const valor = (v[c.campo] ?? '').trim();
    if (c.requerido && !valor) return `Falta ${c.etiqueta.toLowerCase()}.`;
    if (!valor) continue;
    if (c.clase === 'fecha' && !ES_FECHA.test(valor)) return `La fecha de "${c.etiqueta.toLowerCase()}" no vale.`;
    if (c.clase === 'hora' && !ES_HORA.test(valor)) return `La hora de "${c.etiqueta.toLowerCase()}" se escribe como 17:30.`;
    if (c.clase === 'numero' && !/^\d+$/.test(valor)) return `"${c.etiqueta}" es un número.`;
    if (c.clase === 'decimal' && !ES_DECIMAL.test(valor)) return `"${c.etiqueta}" es un número, con coma si hace falta.`;
  }
  if (v.hasta && v.desde && v.hasta < v.desde) return 'La pauta termina antes de empezar.';
  if (v.fecha_fin && v.fecha_inicio && v.fecha_fin < v.fecha_inicio) return 'Termina antes de empezar.';
  if (v.paginas_leidas && v.paginas_totales && Number(v.paginas_leidas) > Number(v.paginas_totales)) {
    return 'Ha leído más páginas de las que tiene el libro.';
  }
  return null;
}

/**
 * Lo que se deduce y no se pregunta: una tarea marcada como hecha se apunta
 * cuándo, y una lectura con fecha de fin deja de estar en curso.
 */
export function normalizar(tabla: TablaFicha, v: Valores, marca: string): Valores {
  const salida: Valores = {};
  Object.entries(v).forEach(([k, texto]) => { salida[k] = (texto ?? '').trim(); });
  // En la hoja los decimales van con punto, se escriban como se escriban.
  FICHAS[tabla].campos
    .filter((c) => c.clase === 'decimal')
    .forEach((c) => { salida[c.campo] = (salida[c.campo] ?? '').replace(',', '.'); });
  if (tabla === 'tareas') {
    const acabada = salida.estado === 'hecha' || salida.estado === 'entregada';
    salida.completada_en = acabada ? (v.completada_en || marca) : '';
  }
  return salida;
}

/** Marcar hecha o desmarcar, que es lo que más se va a tocar. */
export function conEstado(tabla: TablaFicha, antes: Valores, estado: string, marca: string): Valores {
  return normalizar(tabla, { ...antes, estado }, marca);
}

/** Cómo se llama esto en el aviso de "guardado · deshacer". */
export function resumenFicha(tabla: TablaFicha, v: Valores) {
  const titulo = (v.titulo ?? '').trim();
  if (titulo) return titulo;
  // Las medidas no tienen título: se nombran por lo que son.
  if (tabla === 'salud_medidas') {
    const partes = [v.peso_kg ? `${v.peso_kg} kg` : '', v.talla_cm ? `${v.talla_cm} cm` : ''].filter(Boolean);
    return partes.length ? partes.join(' · ') : FICHAS[tabla].nombre;
  }
  return FICHAS[tabla].nombre;
}
