/**
 * Cliente de la API de Apps Script.
 *
 * Todo va por POST con el token en el cuerpo. No es un capricho: una aplicación
 * web de Apps Script no puede leer cabeceras HTTP propias, así que el token no
 * puede viajar en una cabecera; y en la URL quedaría escrito en registros.
 *
 * Dos rarezas de Apps Script que hay que respetar:
 *   · Responde con una redirección 302 a script.googleusercontent.com. fetch la
 *     sigue sola, pero si alguna vez se pone redirect:'manual', deja de funcionar.
 *   · Nunca devuelve un código de estado distinto de 200. El resultado real va
 *     dentro del JSON, en 'ok' y 'error'.
 */

import type {
  RespuestaAgenda, RespuestaBootstrap, RespuestaCustodia, RespuestaLista, RespuestaError,
  RespuestaMenuImagen, RespuestaMenusComedor,
} from '../domain/tipos';

export class ErrorApi extends Error {
  constructor(public codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

/** Mensajes en español para lo que puede fallar. */
const MENSAJES: Record<string, string> = {
  token_invalido: 'El token no vale. Revísalo en Ajustes.',
  ocupado: 'Otra escritura está en curso. Inténtalo otra vez.',
  accion_desconocida: 'Esta versión de la app pide algo que el backend no entiende. Actualiza el script.',
  json_invalido: 'El backend no ha entendido la petición.',
  error_interno: 'Ha fallado algo en el backend.',
  sin_conexion: 'Sin conexión. Lo apuntado se guarda y sube solo cuando haya red.',
  lento: 'El backend tarda demasiado en responder. Se reintenta solo.',
  sin_carpeta_menus: 'La hoja no tiene la carpeta del menú del comedor (config.carpeta_menus).',
  respuesta_rara: 'El backend ha respondido algo que no es JSON. Suele pasar cuando la implementación no está actualizada: vuelve a implementar el script.',
};

export interface Credenciales {
  url: string;
  token: string;
}

/**
 * Cuánto se espera al backend. 'agenda' tarda entre 15 y 20 segundos (lee el
 * calendario y media hoja): con menos margen, una respuesta lenta parecería
 * falta de red.
 */
const TIEMPO_LIMITE = 60000;

async function llamar<T>(
  cred: Credenciales,
  accion: string,
  datos: Record<string, unknown> = {},
): Promise<T> {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), TIEMPO_LIMITE);

  let respuesta: Response;
  try {
    respuesta = await fetch(cred.url, {
      method: 'POST',
      // text/plain evita la petición previa de CORS. En el móvil da igual, pero
      // hace que el mismo código sirva si algún día se prueba desde un navegador.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: cred.token, accion, datos }),
      signal: corte.signal,
    });
  } catch (err) {
    // Cortada por el reloj: hay red, pero el backend no ha contestado a tiempo.
    if (corte.signal.aborted) throw new ErrorApi('lento', MENSAJES.lento);
    throw new ErrorApi('sin_conexion', MENSAJES.sin_conexion);
  } finally {
    clearTimeout(reloj);
  }

  const texto = await respuesta.text();
  let cuerpo: T | RespuestaError;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    throw new ErrorApi('respuesta_rara', MENSAJES.respuesta_rara);
  }

  if ((cuerpo as RespuestaError).ok === false) {
    const e = cuerpo as RespuestaError;
    throw new ErrorApi(e.error, e.mensaje || MENSAJES[e.error] || e.error);
  }
  return cuerpo as T;
}

// ── lectura ───────────────────────────────────────────────────────────

export const bootstrap = (c: Credenciales) =>
  llamar<RespuestaBootstrap>(c, 'bootstrap');

export const agenda = (c: Credenciales, fecha?: string) =>
  llamar<RespuestaAgenda>(c, 'agenda', fecha ? { fecha } : {});

export const listar = <T>(
  c: Credenciales,
  tabla: string,
  filtros: { desde?: string; hasta?: string; nino?: string } = {},
) => llamar<RespuestaLista<T>>(c, 'list', { tabla, ...filtros });

export const custodia = (c: Credenciales, desde: string, hasta: string) =>
  llamar<RespuestaCustodia>(c, 'custodia', { desde, hasta });

export const menusComedor = (c: Credenciales) =>
  llamar<RespuestaMenusComedor>(c, 'menus_comedor');

/** 'actualizado': la versión que ya hay en el móvil, para no descargarla otra vez. */
export const menuImagen = (c: Credenciales, mes: string, actualizado?: string) =>
  llamar<RespuestaMenuImagen>(c, 'menu_imagen', { mes, ...(actualizado ? { actualizado } : {}) });

// ── escritura ─────────────────────────────────────────────────────────

export const crear = <T>(c: Credenciales, tabla: string, datos: Record<string, unknown>) =>
  llamar<{ ok: true; registro: T }>(c, 'create', { tabla, datos });

export const actualizar = <T>(
  c: Credenciales, tabla: string, id: string, datos: Record<string, unknown>,
) => llamar<{ ok: true; registro: T }>(c, 'update', { tabla, id, datos });

export const borrar = (c: Credenciales, tabla: string, id: string) =>
  llamar<{ ok: true }>(c, 'delete', { tabla, id });

export interface OperacionSync {
  accion: 'create' | 'update' | 'delete';
  tabla: string;
  /** El id del registro. En 'create' va además dentro de 'datos'. */
  id: string;
  datos: Record<string, unknown>;
  idLocal: string;
}

export interface ResultadoSync {
  idLocal: string;
  ok: boolean;
  error?: string;
  /** En 'create', el id con el que quedó guardado: puede no ser el enviado. */
  registro?: { id: string } & Record<string, unknown>;
}

/** Vacía la cola de apuntes pendientes. Cada operación responde por separado. */
export const sincronizar = (c: Credenciales, operaciones: OperacionSync[]) =>
  llamar<{ ok: true; resultados: ResultadoSync[] }>(c, 'sync', { operaciones });

/**
 * Comprueba que la dirección y el token valen, sin escribir nada.
 * Es lo que usa la pantalla de conexión.
 */
export async function probarConexion(cred: Credenciales) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(cred.url.trim())) {
    throw new ErrorApi(
      'url_rara',
      'Esa no parece la dirección de la implementación. Tiene que empezar por ' +
      'https://script.google.com/macros/s/ y terminar en /exec',
    );
  }
  const datos = await bootstrap(cred);
  return datos;
}
