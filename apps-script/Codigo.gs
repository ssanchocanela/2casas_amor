/**
 * 2 Casas + Amor — punto de entrada de la API.
 *
 * Todo entra por POST con un cuerpo JSON. El motivo es que una aplicación web de
 * Apps Script NO puede leer cabeceras HTTP personalizadas: el token no puede
 * viajar en una cabecera como en una API normal. Mandarlo en la URL lo dejaría
 * escrito en registros y en el historial, así que va en el cuerpo de un POST.
 *
 * Cuerpo esperado:
 *   { "token": "...", "accion": "agenda", "datos": { ... } }
 */

const VERSION_API = 1;

/**
 * Qué código está publicado. Se sube en cada cambio del backend. Abrir la URL
 * de la implementación en el navegador lo muestra: es la forma de saber si la
 * implementación sirve la versión nueva o se quedó en la anterior.
 */
const VERSION_BACKEND = '2026-09-14.3';

/** Comprobación de que la aplicación está publicada. No pide token ni da datos. */
function doGet() {
  olvidarLecturas();
  return responder({
    ok: true,
    servicio: '2casas',
    version_api: VERSION_API,
    version_backend: VERSION_BACKEND,
    version_esquema: leerConfig().version_esquema || null,
  });
}

function doPost(e) {
  olvidarLecturas();
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responder({ ok: false, error: 'cuerpo_vacio' }, 400);
    }

    let peticion;
    try {
      peticion = JSON.parse(e.postData.contents);
    } catch (err) {
      return responder({ ok: false, error: 'json_invalido' }, 400);
    }

    const autorId = identificar(peticion.token);
    if (!autorId) {
      return responder({ ok: false, error: 'token_invalido' }, 401);
    }

    const accion = peticion.accion;
    const datos = peticion.datos || {};

    switch (accion) {
      // ── lectura ────────────────────────────────────────────────────
      case 'bootstrap':   return responder(accionBootstrap(autorId));
      case 'list':        return responder(accionList(datos));
      case 'agenda':      return responder(accionAgenda(datos));
      case 'custodia':    return responder(accionCustodia(datos));
      case 'menus_comedor': return responder(accionMenusComedor());
      case 'menu_imagen': return responder(accionMenuImagen(datos));

      // ── escritura ──────────────────────────────────────────────────
      case 'create':      return responder(conBloqueo(() => accionCreate(datos, autorId)));
      case 'update':      return responder(conBloqueo(() => accionUpdate(datos, autorId)));
      case 'delete':      return responder(conBloqueo(() => accionDelete(datos, autorId)));
      case 'sync':        return responder(conBloqueo(() => accionSync(datos, autorId)));
      case 'evento_calendar':
        return responder(conBloqueo(() => accionEventoCalendar(datos, autorId)));

      default:
        return responder({ ok: false, error: 'accion_desconocida', accion: accion }, 400);
    }
  } catch (err) {
    console.error(err.stack || err);
    return responder({ ok: false, error: 'error_interno', detalle: String(err) }, 500);
  }
}

/**
 * Envuelve una escritura en el bloqueo del script.
 * Es lo que evita que dos móviles escriban a la vez en la misma fila.
 */
function conBloqueo(fn) {
  const bloqueo = LockService.getScriptLock();
  if (!bloqueo.tryLock(10000)) {
    return { ok: false, error: 'ocupado', mensaje: 'Otra escritura está en curso. Reintenta.' };
  }
  try {
    return fn();
  } finally {
    bloqueo.releaseLock();
  }
}

/** Traduce un token a la persona que lo tiene. Devuelve null si no vale. */
function identificar(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  const crudo = PropertiesService.getScriptProperties().getProperty('TOKENS');
  if (!crudo) return null;
  let mapa;
  try {
    mapa = JSON.parse(crudo);
  } catch (err) {
    return null;
  }
  return mapa[token] || null;
}

function responder(objeto) {
  // Apps Script no permite fijar el código de estado HTTP; el resultado real
  // va siempre dentro del JSON, en 'ok' y 'error'.
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
