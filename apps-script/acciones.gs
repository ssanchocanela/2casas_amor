/**
 * Las acciones de la API. Cada una recibe 'datos' y devuelve un objeto plano.
 */

/** Todo lo que la app necesita para arrancar, en una sola llamada. */
function accionBootstrap(autorId) {
  const config = leerConfig();
  return {
    ok: true,
    version_api: VERSION_API,
    version_backend: VERSION_BACKEND,
    version_esquema: config.version_esquema || null,
    yo: autorId,
    config: config,
    listas: leerListas(),
    personas: leerVigentes('personas').filter((p) => p.activo !== 'no'),
    ninos: leerVigentes('ninos').filter((n) => n.activo !== 'no'),
    custodia_mapeo: leerVigentes('custodia_mapeo'),
    horario_centro: leerVigentes('horario_centro').filter((h) => h.activo !== 'no'),
    horario_lectivo: leerVigentes('horario_lectivo').filter((h) => h.activo !== 'no'),
    extraescolares: leerVigentes('extraescolares').filter((e) => e.activo !== 'no'),
  };
}

/**
 * Filas de una pestaña.
 * datos: { tabla, desde, hasta, nino, incluir_eliminados }
 */
function accionList(datos) {
  const tabla = datos.tabla;
  if (!tabla) return { ok: false, error: 'falta_tabla' };
  if (tabla === 'log') return { ok: false, error: 'log_no_legible' };

  let filas = leerTabla(tabla).filas;
  if (!datos.incluir_eliminados) filas = filas.filter((f) => !f.eliminado_en);

  const campoFecha = COLUMNA_FECHA[tabla];
  if (campoFecha && (datos.desde || datos.hasta)) {
    filas = filas.filter((f) => {
      const v = f[campoFecha];
      if (!v) return false;
      if (datos.desde && v < datos.desde) return false;
      if (datos.hasta && v > datos.hasta) return false;
      return true;
    });
  }

  if (datos.nino) {
    filas = filas.filter((f) => !f.nino_id || f.nino_id === datos.nino);
  }

  filas.forEach((f) => delete f._fila);
  return { ok: true, tabla: tabla, total: filas.length, filas: filas };
}

function accionCreate(datos, autorId) {
  if (!datos.tabla || !datos.datos) return { ok: false, error: 'faltan_datos' };
  const registro = crearFila(datos.tabla, datos.datos, autorId);
  return { ok: true, registro: registro };
}

function accionUpdate(datos, autorId) {
  if (!datos.tabla || !datos.id || !datos.datos) return { ok: false, error: 'faltan_datos' };
  const registro = actualizarFila(datos.tabla, datos.id, datos.datos, autorId);
  delete registro._fila;
  return { ok: true, registro: registro };
}

function accionDelete(datos, autorId) {
  if (!datos.tabla || !datos.id) return { ok: false, error: 'faltan_datos' };
  return { ok: true, registro: borrarFila(datos.tabla, datos.id, autorId) };
}

/**
 * Vacía la cola de apuntes pendientes del móvil de una vez.
 * datos: { operaciones: [ { accion, tabla, id?, datos?, idLocal } ] }
 *
 * Nunca falla entera: cada operación devuelve su propio resultado, para que un
 * apunte con un problema no bloquee a los demás que sí son válidos.
 */
function accionSync(datos, autorId) {
  const operaciones = datos.operaciones || [];
  const resultados = operaciones.map((op) => {
    try {
      switch (op.accion) {
        case 'create':
          return { idLocal: op.idLocal, ok: true, registro: crearFila(op.tabla, op.datos, autorId) };
        case 'update':
          return { idLocal: op.idLocal, ok: true, registro: actualizarFila(op.tabla, op.id, op.datos, autorId) };
        case 'delete':
          return { idLocal: op.idLocal, ok: true, registro: borrarFila(op.tabla, op.id, autorId) };
        default:
          return { idLocal: op.idLocal, ok: false, error: 'accion_desconocida' };
      }
    } catch (err) {
      return { idLocal: op.idLocal, ok: false, error: String(err) };
    }
  });
  return { ok: true, resultados: resultados };
}
