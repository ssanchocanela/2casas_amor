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
