/**
 * 2 CASAS + AMOR — backend completo en un solo fichero.
 *
 * Pega todo esto dentro de "Codigo.gs" en el editor de Apps Script de la hoja
 * (Extensiones → Apps Script), sustituyendo lo que hubiera.
 *
 * Es exactamente el mismo código que los ficheros sueltos de apps-script/,
 * concatenados para que la instalación a mano sea un solo pegado. Cuando el
 * proyecto se suba con clasp, se vuelve a los ficheros separados y este se
 * regenera con scripts/juntar_backend.py.
 *
 * Instrucciones completas: apps-script/LEEME-instalacion.md
 */


// ======================================================================
// tablas.gs
// ======================================================================

/**
 * Acceso genérico a las pestañas de la hoja.
 *
 * Dos reglas gobiernan este fichero:
 *   1. Las columnas se localizan SIEMPRE por nombre de cabecera, nunca por
 *      índice. Alguien editará la hoja a mano y moverá algo.
 *   2. Nada se borra. Dar de baja es rellenar 'eliminado_en'.
 */

const ZONA = 'Europe/Madrid';

/** Prefijo del identificador de cada tabla. */
const PREFIJOS = {
  personas: 'per', ninos: 'nin', custodia_mapeo: 'cum',
  horario_centro: 'hce', horario_lectivo: 'hor', extraescolares: 'ext',
  calendario_escolar: 'cal', menu_casa: 'men', registro_nino: 'reg',
  salud_eventos: 'sal', salud_medidas: 'med', tareas: 'tar',
  lecturas: 'lec', eventos: 'eve', menu_comedor: 'mnu', log: 'log',
};

/** Qué columna usar al filtrar por rango de fechas en cada tabla. */
const COLUMNA_FECHA = {
  menu_casa: 'fecha', registro_nino: 'fecha', salud_eventos: 'fecha',
  salud_medidas: 'fecha', tareas: 'fecha_entrega', lecturas: 'fecha_inicio',
  eventos: 'fecha_inicio', menu_comedor: 'fecha', calendario_escolar: 'fecha',
};

/** Tablas en las que la app puede escribir. El resto son de solo lectura. */
const ESCRIBIBLES = [
  'menu_casa', 'registro_nino', 'salud_eventos', 'salud_medidas',
  'tareas', 'lecturas', 'eventos', 'menu_comedor',
  'calendario_escolar', 'horario_lectivo', 'extraescolares',
  'horario_centro', 'ninos', 'personas', 'custodia_mapeo',
];

function libro() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Localiza la fila de cabeceras de una pestaña.
 * Varias pestañas llevan una nota gris en la fila 1 (una sola celda con texto),
 * así que la cabecera es la primera fila con dos o más celdas rellenas.
 */
function filaCabecera(hoja) {
  const alto = Math.min(hoja.getLastRow(), 6);
  if (alto === 0) return 1;
  const muestra = hoja.getRange(1, 1, alto, hoja.getLastColumn()).getValues();
  for (let i = 0; i < muestra.length; i++) {
    const llenas = muestra[i].filter((c) => String(c).trim() !== '').length;
    if (llenas >= 2) return i + 1;
  }
  return 1;
}

/**
 * Lee una pestaña entera como lista de objetos.
 * Devuelve { cabeceras, filas, primeraFilaDatos }.
 * 'filas' incluye _fila (el número de fila real, para poder actualizarla).
 */
function leerTabla(nombre) {
  if (!LEIDAS[nombre]) LEIDAS[nombre] = leerTablaDeLaHoja(nombre);
  const t = LEIDAS[nombre];
  // Copias: quien lee puede tocar las filas (actualizarFila, list…) sin
  // estropear lo guardado para la siguiente lectura.
  return {
    cabeceras: t.cabeceras.slice(),
    filas: t.filas.map((f) => Object.assign({}, f)),
    primeraFilaDatos: t.primeraFilaDatos,
  };
}

/**
 * Lo leído en esta petición. Una agenda consulta la misma pestaña muchas veces
 * (config, horarios, calendario escolar…) y cada ida a la hoja cuesta: así cada
 * pestaña se lee una sola vez. Toda escritura olvida su pestaña, y cada petición
 * empieza de cero: doGet y doPost vacían esto al entrar.
 */
let LEIDAS = {};

function olvidarLecturas(nombre) {
  if (nombre) delete LEIDAS[nombre];
  else LEIDAS = {};
}

function leerTablaDeLaHoja(nombre) {
  const hoja = libro().getSheetByName(nombre);
  if (!hoja) throw new Error('No existe la pestaña: ' + nombre);

  const fc = filaCabecera(hoja);
  const ultima = hoja.getLastRow();
  const ancho = hoja.getLastColumn();
  const cabeceras = hoja.getRange(fc, 1, 1, ancho).getValues()[0]
    .map((c) => String(c).trim());

  const filas = [];
  if (ultima > fc) {
    const datos = hoja.getRange(fc + 1, 1, ultima - fc, ancho).getValues();
    datos.forEach((fila, i) => {
      if (fila.every((c) => String(c).trim() === '')) return;
      const obj = { _fila: fc + 1 + i };
      cabeceras.forEach((cab, j) => {
        if (cab) obj[cab] = normalizar(cab, fila[j]);
      });
      filas.push(obj);
    });
  }
  return { cabeceras: cabeceras, filas: filas, primeraFilaDatos: fc + 1 };
}

/** Solo las filas vigentes: las que no tienen 'eliminado_en'. */
function leerVigentes(nombre) {
  return leerTabla(nombre).filas.filter((f) => !f.eliminado_en);
}

/** Columnas que guardan una hora suelta. */
const COLUMNAS_HORA = [
  'hora', 'hora_inicio', 'hora_fin',
  'entrada_desde', 'entrada_hasta', 'salida_desde', 'salida_hasta',
];

/** Columnas que guardan fecha y hora juntas. */
const COLUMNAS_MARCA = ['creado_en', 'eliminado_en', 'completada_en', 'timestamp'];

/**
 * Normaliza lo que devuelve la hoja.
 *
 * Google Sheets puede convertir '2026-10-01' en una fecha de verdad y '08:50' en
 * una hora al importar el fichero, y entonces getValues() devuelve objetos Date
 * en vez de texto. Aquí todo vuelve al formato acordado, venga como venga.
 * Una hora suelta la guarda Sheets como 30/12/1899 con la hora encima: de ahí la
 * comprobación del año.
 */
function normalizar(cabecera, valor) {
  if (valor instanceof Date) {
    if (COLUMNAS_MARCA.indexOf(cabecera) >= 0) {
      return Utilities.formatDate(valor, ZONA, 'yyyy-MM-dd HH:mm');
    }
    const esHora = COLUMNAS_HORA.indexOf(cabecera) >= 0 || valor.getFullYear() < 1900;
    return Utilities.formatDate(valor, ZONA, esHora ? 'HH:mm' : 'yyyy-MM-dd');
  }
  if (typeof valor === 'string') return valor.trim();
  return valor;
}

function hoy() {
  return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
}

function ahora() {
  return Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd HH:mm');
}

/**
 * Regla 7: fechas y horas se guardan como TEXTO. Si se escribe '21:42' en una
 * celda con formato automático, Sheets lo convierte en una hora de 1899 en la
 * zona horaria de la hoja, y al leerla desde Madrid sale otra (hasta con los
 * minutos cambiados, por el horario solar de entonces). Con formato de texto
 * plano, lo que se escribe es exactamente lo que se lee.
 */
function comoTexto(valor) {
  return valor === undefined || valor === null ? '' : String(valor);
}

function escribirComoTexto(rango, valor) {
  rango.setNumberFormat('@').setValue(comoTexto(valor));
}

/** Añade una fila al final como texto plano. Sustituye a appendRow. */
function anadirComoTexto(hoja, valores) {
  hoja.getRange(hoja.getLastRow() + 1, 1, 1, valores.length)
    .setNumberFormat('@')
    .setValues([valores.map(comoTexto)]);
}

/** prefijo_AAAAMMDD_xxxx */
function nuevoId(tabla) {
  const prefijo = PREFIJOS[tabla] || tabla.substring(0, 3);
  const fecha = Utilities.formatDate(new Date(), ZONA, 'yyyyMMdd');
  const azar = Utilities.getUuid().replace(/-/g, '').substring(0, 4);
  return prefijo + '_' + fecha + '_' + azar;
}

/**
 * Añade una fila. Devuelve el registro creado.
 *
 * La app genera el 'id' al apuntar, sin red, y reenvía el apunte si no le llegó
 * la respuesta (la red se cortó a mitad). Por eso un 'id' que ya existe no
 * duplica la fila:
 *   · mismo id y mismos datos → es un reintento: se devuelve la fila guardada.
 *   · mismo id y datos distintos → dos móviles han sacado el mismo id: se guarda
 *     con un id nuevo, que va en la respuesta.
 */
function crearFila(tabla, datos, autorId) {
  comprobarEscribible(tabla);
  const hoja = libro().getSheetByName(tabla);
  const { cabeceras, filas } = leerTabla(tabla);

  const registro = Object.assign({}, datos);
  if (registro.id) {
    const existente = filas.filter((f) => f.id === registro.id)[0];
    if (existente && mismosDatos(existente, registro)) {
      delete existente._fila;
      return existente;
    }
    if (existente) registro.id = nuevoId(tabla);
  }
  if (!registro.id) registro.id = nuevoId(tabla);
  if (cabeceras.indexOf('creado_en') >= 0 && !registro.creado_en) registro.creado_en = ahora();
  if (cabeceras.indexOf('autor_id') >= 0 && !registro.autor_id) registro.autor_id = autorId;

  anadirComoTexto(hoja, cabeceras.map((c) => registro[c]));
  olvidarLecturas(tabla);

  registrarLog(autorId, 'crear', tabla, registro.id, '', '', '');
  return registro;
}

/** true si cada campo enviado que existe en la fila tiene el mismo valor. */
function mismosDatos(fila, datos) {
  const texto = (v) => (v === undefined || v === null ? '' : String(v));
  return Object.keys(datos).every((campo) => !(campo in fila) || texto(fila[campo]) === texto(datos[campo]));
}

/** Modifica una fila localizada por 'id'. Devuelve el registro resultante. */
function actualizarFila(tabla, id, cambios, autorId) {
  comprobarEscribible(tabla);
  const hoja = libro().getSheetByName(tabla);
  const { cabeceras, filas } = leerTabla(tabla);
  const actual = filas.filter((f) => f.id === id)[0];
  if (!actual) throw new Error('No existe el registro ' + id + ' en ' + tabla);
  // El borrado siempre gana: lo borrado no se edita, ni se "desborra" vaciando
  // eliminado_en. Para borrar está borrarFila.
  if (actual.eliminado_en) {
    delete actual._fila;
    return actual;
  }

  Object.keys(cambios).forEach((campo) => {
    const col = cabeceras.indexOf(campo);
    if (col < 0 || campo === 'id' || campo === 'eliminado_en') return;
    const anterior = actual[campo];
    const nuevo = cambios[campo];
    if (String(anterior || '') === String(nuevo || '')) return;
    escribirComoTexto(hoja.getRange(actual._fila, col + 1), nuevo);
    registrarLog(autorId, 'editar', tabla, id, campo, anterior, nuevo);
    actual[campo] = nuevo;
  });
  olvidarLecturas(tabla);

  return actual;
}

/** Borrado lógico: rellena 'eliminado_en'. La fila nunca se elimina. */
function borrarFila(tabla, id, autorId) {
  comprobarEscribible(tabla);
  const hoja = libro().getSheetByName(tabla);
  const { cabeceras, filas } = leerTabla(tabla);
  const col = cabeceras.indexOf('eliminado_en');
  if (col < 0) throw new Error('La pestaña ' + tabla + ' no admite borrado lógico');

  const actual = filas.filter((f) => f.id === id)[0];
  if (!actual) throw new Error('No existe el registro ' + id + ' en ' + tabla);
  // Borrar lo ya borrado (un reintento de la cola) no cambia la marca ni el log.
  if (actual.eliminado_en) return { id: id, eliminado_en: actual.eliminado_en };

  const sello = ahora();
  escribirComoTexto(hoja.getRange(actual._fila, col + 1), sello);
  olvidarLecturas(tabla);
  registrarLog(autorId, 'borrar', tabla, id, 'eliminado_en', '', sello);
  return { id: id, eliminado_en: sello };
}

function comprobarEscribible(tabla) {
  if (ESCRIBIBLES.indexOf(tabla) < 0) {
    throw new Error('La pestaña ' + tabla + ' no admite escritura desde la app');
  }
}

/** Toda escritura deja rastro. Sin excepciones. */
function registrarLog(autorId, accion, tabla, registroId, campo, anterior, nuevo) {
  try {
    const hoja = libro().getSheetByName('log');
    if (!hoja) return;
    anadirComoTexto(hoja, [
      nuevoId('log'), ahora(), autorId, accion, tabla, registroId,
      campo || '', anterior, nuevo, 'app',
    ]);
    olvidarLecturas('log');
  } catch (err) {
    console.error('No se pudo escribir en el log: ' + err);
  }
}

/** La pestaña config como objeto clave → valor. */
function leerConfig() {
  const salida = {};
  try {
    leerTabla('config').filas.forEach((f) => {
      if (f.clave) salida[f.clave] = f.valor;
    });
  } catch (err) {
    console.error('No se pudo leer config: ' + err);
  }
  return salida;
}

/** La pestaña listas como { nombre_lista: [valores] }. */
function leerListas() {
  const { cabeceras, filas } = leerTabla('listas');
  const salida = {};
  cabeceras.forEach((c) => {
    if (!c) return;
    salida[c] = filas.map((f) => f[c]).filter((v) => v !== '' && v !== undefined && v !== null);
  });
  return salida;
}


// ======================================================================
// acciones.gs
// ======================================================================

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


// ======================================================================
// agenda.gs
// ======================================================================

/**
 * La vista compuesta de un día: todo lo que pinta la pantalla "Hoy",
 * en una sola llamada.
 *
 * Lo interesante de este fichero son 'calcularRecogida' y 'calcularEquipamiento':
 * no leen un dato guardado, lo deducen. Son las dos preguntas de cada tarde.
 */

function accionAgenda(datos) {
  const fecha = datos.fecha || hoy();
  const manana = sumarDias(fecha, 1);

  const ninos = leerVigentes('ninos').filter((n) => n.activo !== 'no');
  // Una sola ida al calendario: sirve para hoy y para buscar el próximo cambio.
  const custodia = leerCustodia(fecha, sumarDias(fecha, 21));

  const porNino = ninos.map((nino) => ({
    nino_id: nino.id,
    nombre: nino.nombre,
    color_hex: nino.color_hex,
    custodia: (custodia[fecha] && custodia[fecha][nino.id]) || null,
    // Un día sin cole (fin de semana, festivo, vacaciones) no trae clases,
    // aunque el horario sea fijo para todo el curso.
    clases: hayClase(fecha) ? clasesDe(nino.id, fecha) : [],
    recogida: calcularRecogida(nino.id, fecha),
    equipamiento_manana: calcularEquipamiento(nino.id, manana),
  }));

  return {
    ok: true,
    fecha: fecha,
    dia_semana: diaSemana(fecha),
    escolar: escolarDe(fecha),
    ninos: porNino,
    proximo_cambio: proximoCambio(fecha, custodia),
    menu_comedor: unaFila('menu_comedor', (f) => f.fecha === fecha),
    menu_casa: leerVigentes('menu_casa').filter((f) => f.fecha === fecha),
    registro: leerVigentes('registro_nino').filter((f) => f.fecha === fecha),
    tareas_vencen: leerVigentes('tareas').filter(
      (t) => (t.fecha_entrega === fecha || t.fecha_entrega === manana) &&
             t.estado !== 'entregada' && t.estado !== 'hecha'
    ),
    eventos: leerVigentes('eventos').filter(
      (e) => e.fecha_inicio && e.fecha_inicio <= fecha &&
             (!e.fecha_fin || e.fecha_fin >= fecha)
    ),
    tratamientos_activos: leerVigentes('salud_eventos').filter(
      (s) => s.tipo === 'medicacion' && s.desde && s.desde <= fecha &&
             (!s.hasta || s.hasta >= fecha)
    ),
  };
}

/**
 * A qué hora y por dónde hay que recoger a un niño ese día.
 *
 * Manda la extraescolar sobre la salida ordinaria: si hay actividad, se sale
 * cuando termina la actividad. Si el día no es lectivo, no hay recogida.
 */
function calcularRecogida(ninoId, fecha) {
  const escolar = escolarDe(fecha);
  if (escolar && (escolar.tipo === 'festivo' || escolar.tipo === 'no_lectivo' ||
                  escolar.tipo === 'vacaciones')) {
    return { hay: false, motivo: escolar.tipo, descripcion: escolar.descripcion || '' };
  }
  if (diaSemana(fecha) > 5) {
    return { hay: false, motivo: 'fin_de_semana' };
  }

  const centro = leerVigentes('horario_centro').filter(
    (h) => h.nino_id === ninoId && h.activo !== 'no'
  )[0];

  const actividades = extraescolaresDe(ninoId, fecha)
    .filter((e) => e.hora_fin)
    // La actividad de mediodía no cambia la hora de salida de la tarde.
    .filter((e) => !e.hora_inicio || e.hora_inicio >= '15:00');

  if (actividades.length) {
    const ultima = actividades.sort((a, b) => (a.hora_fin < b.hora_fin ? 1 : -1))[0];
    return {
      hay: true,
      hora: ultima.hora_fin,
      motivo: 'extraescolar',
      actividad: ultima.actividad,
      lugar: ultima.lugar || (centro ? centro.puerta : ''),
      notas: ultima.notas || '',
    };
  }

  if (!centro) return { hay: true, hora: null, motivo: 'sin_horario' };

  return {
    hay: true,
    hora: centro.salida_desde,
    hora_hasta: centro.salida_hasta,
    motivo: 'salida_ordinaria',
    lugar: centro.puerta,
    notas: centro.notas || '',
  };
}

/**
 * Qué hay que llevar ese día: CH chándal, PS piscina, CH+PS las dos cosas.
 * Sale tanto de las clases como de las extraescolares.
 */
function calcularEquipamiento(ninoId, fecha) {
  if (diaSemana(fecha) > 5) return [];
  const escolar = escolarDe(fecha);
  if (escolar && (escolar.tipo === 'festivo' || escolar.tipo === 'no_lectivo' ||
                  escolar.tipo === 'vacaciones')) {
    return [];
  }

  const codigos = {};
  const anotar = (origen, codigo) => {
    if (!codigo) return;
    String(codigo).split('+').forEach((c) => {
      c = c.trim().toUpperCase();
      if (!c) return;
      if (!codigos[c]) codigos[c] = [];
      codigos[c].push(origen);
    });
  };

  clasesDe(ninoId, fecha).forEach((c) => anotar(c.asignatura, c.equipamiento));
  extraescolaresDe(ninoId, fecha).forEach((e) => anotar(e.actividad, e.equipamiento));

  const nombres = { CH: 'chándal', PS: 'material de piscina' };
  return Object.keys(codigos).map((c) => ({
    codigo: c,
    nombre: nombres[c] || c,
    porque: codigos[c],
  }));
}

/** Las clases de un niño ese día, ordenadas. */
function clasesDe(ninoId, fecha) {
  const dia = diaSemana(fecha);
  const curso = leerConfig().curso_escolar;
  return leerVigentes('horario_lectivo')
    .filter((h) => h.nino_id === ninoId &&
                   Number(h.dia_semana) === dia &&
                   h.activo !== 'no' &&
                   (!curso || !h.curso_escolar || h.curso_escolar === curso))
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

/**
 * Las extraescolares de un niño ese día.
 * 'fecha_desde' es a partir de cuándo arranca la actividad, no el día de la
 * primera clase: por eso se compara con la fecha, no con el día de la semana.
 */
function extraescolaresDe(ninoId, fecha) {
  const dia = diaSemana(fecha);
  const curso = leerConfig().curso_escolar;
  return leerVigentes('extraescolares').filter(
    (e) => e.nino_id === ninoId &&
           Number(e.dia_semana) === dia &&
           e.activo !== 'no' &&
           (!curso || !e.curso_escolar || e.curso_escolar === curso) &&
           (!e.fecha_desde || fecha >= e.fecha_desde) &&
           (!e.fecha_hasta || fecha <= e.fecha_hasta)
  );
}

function escolarDe(fecha) {
  return unaFila('calendario_escolar', (f) => f.fecha === fecha);
}

/** Si ese día hay cole: entre semana y sin festivo, día no lectivo ni vacaciones. */
function hayClase(fecha) {
  if (diaSemana(fecha) > 5) return false;
  const escolar = escolarDe(fecha);
  return !(escolar && (escolar.tipo === 'festivo' || escolar.tipo === 'no_lectivo' ||
                       escolar.tipo === 'vacaciones'));
}

/**
 * Cuándo cambia la custodia a partir de una fecha. Mira 21 días por delante.
 * 'custodia' es opcional: la agenda la pasa ya leída para no ir dos veces al
 * calendario, que es lo más lento de todo.
 */
function proximoCambio(fecha, custodia) {
  if (!custodia) custodia = leerCustodia(fecha, sumarDias(fecha, 21));
  const dias = Object.keys(custodia).sort();
  if (!dias.length) return null;

  const inicial = JSON.stringify(custodia[dias[0]] || {});
  for (let i = 1; i < dias.length; i++) {
    if (JSON.stringify(custodia[dias[i]] || {}) !== inicial) {
      return { fecha: dias[i], custodia: custodia[dias[i]] };
    }
  }
  return null;
}

// ── utilidades de fecha ──────────────────────────────────────────────

/** 1 lunes … 7 domingo. */
function diaSemana(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return ((d.getDay() + 6) % 7) + 1;
}

function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, ZONA, 'yyyy-MM-dd');
}

function unaFila(tabla, filtro) {
  const encontradas = leerVigentes(tabla).filter(filtro);
  return encontradas.length ? encontradas[0] : null;
}


// ======================================================================
// custodia.gs
// ======================================================================

/**
 * La custodia vive en Google Calendar, no en la hoja.
 *
 * El calendario ya existía antes que la app y se sigue usando desde el móvil,
 * así que la app se adapta a los títulos que ya tiene, en vez de obligar a
 * reescribirlos. La traducción está en la pestaña 'custodia_mapeo'.
 */

function accionCustodia(datos) {
  const desde = datos.desde || hoy();
  const hasta = datos.hasta || sumarDias(desde, 30);
  return { ok: true, desde: desde, hasta: hasta, dias: leerCustodia(desde, hasta) };
}

/**
 * Devuelve { 'AAAA-MM-DD': { nino_id: { persona_id, nombre, color_hex, titulo } } }
 */
function leerCustodia(desde, hasta) {
  const config = leerConfig();
  const idCalendario = config.calendar_id_custodia;
  if (!idCalendario) return {};

  const calendario = CalendarApp.getCalendarById(idCalendario);
  if (!calendario) {
    console.error('No se encuentra el calendario ' + idCalendario);
    return {};
  }

  const mapeo = leerVigentes('custodia_mapeo');
  const personas = {};
  leerVigentes('personas').forEach((p) => { personas[p.id] = p; });
  const ninos = leerVigentes('ninos').filter((n) => n.activo !== 'no');

  const eventos = calendario.getEvents(
    new Date(desde + 'T00:00:00'),
    new Date(sumarDias(hasta, 1) + 'T00:00:00')
  );

  const dias = {};
  eventos.forEach((evento) => {
    const titulo = evento.getTitle();
    const reglas = mapeo.filter((m) => coincide(titulo, m.texto_evento, m.coincidencia));
    if (!reglas.length) return;

    // Un evento de día completo termina a las 00:00 del día siguiente.
    const inicio = Utilities.formatDate(evento.getStartTime(), ZONA, 'yyyy-MM-dd');
    let fin = Utilities.formatDate(evento.getEndTime(), ZONA, 'yyyy-MM-dd');
    if (evento.isAllDayEvent()) fin = sumarDias(fin, -1);
    if (fin < inicio) fin = inicio;

    reglas.forEach((regla) => {
      const persona = personas[regla.persona_id];
      if (!persona) return;
      const destinatarios = regla.nino_id ? [regla.nino_id] : ninos.map((n) => n.id);

      let f = inicio;
      let guarda = 0;
      while (f <= fin && guarda++ < 400) {
        if (f >= desde && f <= hasta) {
          if (!dias[f]) dias[f] = {};
          destinatarios.forEach((ninoId) => {
            dias[f][ninoId] = {
              persona_id: persona.id,
              nombre: persona.nombre,
              color_hex: persona.color_hex,
              titulo: titulo,
            };
          });
        }
        f = sumarDias(f, 1);
      }
    });
  });

  return dias;
}

function coincide(titulo, patron, modo) {
  if (!patron) return false;
  const t = String(titulo).toLowerCase().trim();
  const p = String(patron).toLowerCase().trim();
  switch (modo) {
    case 'exacta':      return t === p;
    case 'empieza_por': return t.indexOf(p) === 0;
    default:            return t.indexOf(p) >= 0; // 'contiene'
  }
}

/**
 * Crea o actualiza un evento en el calendario a partir de una fila de 'eventos'.
 * Guarda el id devuelto en 'calendar_event_id' para no duplicarlo la próxima vez.
 */
function accionEventoCalendar(datos, autorId) {
  const id = datos.id;
  if (!id) return { ok: false, error: 'falta_id' };

  const evento = leerVigentes('eventos').filter((e) => e.id === id)[0];
  if (!evento) return { ok: false, error: 'evento_no_encontrado' };

  const config = leerConfig();
  const idCalendario = config.calendar_id_colegio || config.calendar_id_custodia;
  if (!idCalendario) return { ok: false, error: 'sin_calendario_configurado' };

  const calendario = CalendarApp.getCalendarById(idCalendario);
  if (!calendario) return { ok: false, error: 'calendario_no_encontrado' };

  const ninos = {};
  leerVigentes('ninos').forEach((n) => { ninos[n.id] = n.nombre; });
  const quien = evento.nino_id ? (ninos[evento.nino_id] || '') : 'Niño1 y Niña2';
  const titulo = quien ? quien + ' · ' + evento.titulo : evento.titulo;

  const inicio = new Date(evento.fecha_inicio + 'T' + (evento.hora_inicio || '00:00') + ':00');
  const finFecha = evento.fecha_fin || evento.fecha_inicio;
  const todoElDia = !evento.hora_inicio;

  let creado;
  if (evento.calendar_event_id) {
    try {
      const existente = calendario.getEventById(evento.calendar_event_id);
      if (existente) existente.deleteEvent();
    } catch (err) {
      console.error('No se pudo borrar el evento anterior: ' + err);
    }
  }

  if (todoElDia) {
    creado = (finFecha === evento.fecha_inicio)
      ? calendario.createAllDayEvent(titulo, inicio)
      : calendario.createAllDayEvent(titulo, inicio, new Date(sumarDias(finFecha, 1) + 'T00:00:00'));
  } else {
    const fin = new Date(finFecha + 'T' + (evento.hora_fin || evento.hora_inicio) + ':00');
    creado = calendario.createEvent(titulo, inicio, fin);
  }

  if (evento.notas) creado.setDescription(evento.notas);
  if (evento.lugar) creado.setLocation(evento.lugar);

  actualizarFila('eventos', id, { calendar_event_id: creado.getId() }, autorId);
  return { ok: true, calendar_event_id: creado.getId() };
}


// ======================================================================
// menus.gs
// ======================================================================

/**
 * El menú del comedor en imagen: el que da el colegio cada mes.
 *
 * Vive en una carpeta de Drive de la cuenta neutral (config.carpeta_menus), una
 * imagen por mes con el nombre AAAA-MM (2026-09.jpg). Para añadir un mes basta
 * con subir la foto a la carpeta: ni la app ni el script se tocan.
 *
 * La carpeta no se comparte por enlace. La app recibe la imagen aquí, con el
 * token, y la guarda en el móvil para verla sin red.
 */

const PATRON_MENU = /^(\d{4}-\d{2})\.(jpe?g|png|webp)$/i;

function carpetaMenus() {
  const id = leerConfig().carpeta_menus;
  if (!id) return null;
  return DriveApp.getFolderById(String(id).trim());
}

/**
 * Los meses con imagen, del más antiguo al más nuevo:
 * [{ mes, nombre, actualizado, archivo }]. Null si no hay carpeta configurada.
 */
function listarMenus() {
  const carpeta = carpetaMenus();
  if (!carpeta) return null;
  const archivos = carpeta.getFiles();
  const porMes = {};
  while (archivos.hasNext()) {
    const archivo = archivos.next();
    const m = PATRON_MENU.exec(archivo.getName());
    if (!m) continue;
    const actualizado = archivo.getLastUpdated().toISOString();
    // Dos imágenes del mismo mes (una .jpg y otra .png): manda la más reciente.
    if (!porMes[m[1]] || porMes[m[1]].actualizado < actualizado) {
      porMes[m[1]] = { mes: m[1], nombre: archivo.getName(), actualizado: actualizado, archivo: archivo };
    }
  }
  return Object.keys(porMes).sort().map((mes) => porMes[mes]);
}

function accionMenusComedor() {
  let menus;
  try {
    menus = listarMenus();
  } catch (err) {
    return errorCarpetaMenus(err);
  }
  if (!menus) return { ok: false, error: 'sin_carpeta_menus' };
  return {
    ok: true,
    menus: menus.map((m) => ({ mes: m.mes, nombre: m.nombre, actualizado: m.actualizado })),
  };
}

/**
 * La imagen de un mes, en base64.
 * datos: { mes: 'AAAA-MM', actualizado? }
 * Si el móvil ya tiene esa misma versión ('actualizado' coincide), no se vuelve
 * a mandar: la imagen pesa y el menú casi nunca cambia.
 */
function accionMenuImagen(datos) {
  if (!/^\d{4}-\d{2}$/.test(datos.mes || '')) return { ok: false, error: 'falta_mes' };
  let menus;
  try {
    menus = listarMenus();
  } catch (err) {
    return errorCarpetaMenus(err);
  }
  if (!menus) return { ok: false, error: 'sin_carpeta_menus' };

  const menu = menus.filter((m) => m.mes === datos.mes)[0];
  if (!menu) return { ok: true, mes: datos.mes, hay: false };
  if (datos.actualizado && datos.actualizado === menu.actualizado) {
    return { ok: true, mes: menu.mes, hay: true, sin_cambios: true, actualizado: menu.actualizado };
  }

  const blob = menu.archivo.getBlob();
  return {
    ok: true,
    mes: menu.mes,
    hay: true,
    nombre: menu.nombre,
    tipo: blob.getContentType(),
    actualizado: menu.actualizado,
    base64: Utilities.base64Encode(blob.getBytes()),
  };
}

function errorCarpetaMenus(err) {
  console.error('No se puede leer la carpeta de menús: ' + err);
  return {
    ok: false,
    error: 'carpeta_menus_inaccesible',
    mensaje: 'El script no puede abrir la carpeta de menús. Revisa que config.carpeta_menus ' +
      'sea el id bueno y que la carpeta sea de la cuenta neutral o esté compartida con ella.',
  };
}


// ======================================================================
// instalar.gs
// ======================================================================

/**
 * Funciones que se ejecutan A MANO desde el editor de Apps Script.
 * No forman parte de la API y nadie las llama desde la app.
 */

/**
 * Genera un token por cada persona de la pestaña 'personas' y los guarda.
 *
 * Ejecutar UNA VEZ al instalar. Los tokens aparecen en el registro de ejecución
 * (Ver → Registros). Cópialos de ahí a la app y no los guardes en ningún
 * fichero del repositorio.
 *
 * Volver a ejecutarla INVALIDA los tokens anteriores: sirve para revocar el
 * acceso de alguien sin tocar nada más.
 */
function generarTokens() {
  const personas = leerVigentes('personas').filter((p) => p.activo !== 'no');
  const mapa = {};
  const salida = [];

  personas.forEach((p) => {
    const token = Utilities.getUuid().replace(/-/g, '') +
                  Utilities.getUuid().replace(/-/g, '').substring(0, 8);
    mapa[token] = p.id;
    salida.push(p.nombre + ' (' + p.id + '):\n  ' + token);
  });

  PropertiesService.getScriptProperties().setProperty('TOKENS', JSON.stringify(mapa));

  console.log('TOKENS GENERADOS — cópialos ahora, no se vuelven a mostrar:\n\n' +
              salida.join('\n\n'));
  return salida.length + ' tokens generados. Míralos en el registro de ejecución.';
}

/**
 * Comprueba que la hoja está bien montada antes de publicar nada.
 * Ejecutar después de rellenar los datos fijos.
 */
function comprobarHoja() {
  const esperadas = [
    'config', 'personas', 'ninos', 'custodia_mapeo', 'horario_centro',
    'horario_lectivo', 'extraescolares', 'calendario_escolar', 'menu_casa',
    'registro_nino', 'salud_eventos', 'salud_medidas', 'tareas', 'lecturas',
    'eventos', 'menu_comedor', 'listas', 'log',
  ];

  const problemas = [];
  const existentes = libro().getSheets().map((h) => h.getName());

  esperadas.forEach((nombre) => {
    if (existentes.indexOf(nombre) < 0) {
      problemas.push('FALTA la pestaña: ' + nombre);
      return;
    }
    try {
      const { cabeceras, filas } = leerTabla(nombre);
      if (!cabeceras.filter(String).length) problemas.push(nombre + ': sin cabeceras');
      console.log(nombre + ': ' + filas.length + ' filas, ' +
                  cabeceras.filter(String).length + ' columnas');
    } catch (err) {
      problemas.push(nombre + ': ' + err);
    }
  });

  const config = leerConfig();
  if (!config.version_esquema) problemas.push('config: falta version_esquema');
  if (!config.curso_escolar) problemas.push('config: falta curso_escolar');
  if (!config.calendar_id_custodia) {
    problemas.push('config: falta calendar_id_custodia (la custodia saldrá vacía)');
  } else {
    const cal = CalendarApp.getCalendarById(config.calendar_id_custodia);
    if (!cal) problemas.push('config: el calendar_id_custodia no corresponde a ningún calendario al que tenga acceso esta cuenta');
    else console.log('Calendario encontrado: ' + cal.getName());
  }

  // Leer la carpeta aquí es también lo que hace que Google pida el permiso de Drive.
  if (config.carpeta_menus) {
    try {
      const menus = listarMenus();
      console.log('Carpeta de menús: ' +
        (menus.length ? menus.map((m) => m.nombre).join(', ') : 'vacía (sube una imagen AAAA-MM.jpg por mes)'));
    } catch (err) {
      problemas.push('config: el script no puede abrir la carpeta de carpeta_menus (' + err + ')');
    }
  } else {
    console.log('config: sin carpeta_menus; el menú del comedor en imagen no se verá en la app');
  }

  if (!leerVigentes('custodia_mapeo').length) {
    problemas.push('custodia_mapeo: vacío, la app no sabrá interpretar el calendario');
  }
  if (!leerVigentes('ninos').length) problemas.push('ninos: vacío');
  if (!leerVigentes('personas').length) problemas.push('personas: vacío');

  if (problemas.length) {
    console.warn('PROBLEMAS ENCONTRADOS:\n· ' + problemas.join('\n· '));
  } else {
    console.log('Todo correcto. La hoja está lista.');
  }
  return problemas.length ? problemas : 'Todo correcto.';
}

/**
 * Prueba la agenda de hoy sin pasar por la app.
 * Es la forma rápida de ver si la recogida y el equipamiento salen bien.
 */
function probarAgenda() {
  const resultado = accionAgenda({ fecha: hoy() });
  console.log(JSON.stringify(resultado, null, 2));
  return resultado;
}


// ======================================================================
// Codigo.gs
// ======================================================================

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

