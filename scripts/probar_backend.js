/**
 * Ejecuta el Apps Script fuera de Google, contra los datos reales de la hoja.
 *
 * Simula lo justo del entorno de Google (SpreadsheetApp, Utilities, …) y carga
 * los ficheros .gs tal cual. Sirve para comprobar la lógica de recogida y
 * equipamiento sin tener que publicar nada.
 *
 *   node scripts/probar_backend.js
 *
 * Lee los datos de /tmp/hoja.json, que genera scripts/volcar_hoja.py.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const hojas = JSON.parse(fs.readFileSync('/tmp/hoja.json', 'utf8'));

// ── simulación mínima del entorno de Apps Script ──────────────────────

/** Cuántas veces se ha ido a la hoja: cada ida, en Google, cuesta tiempo. */
let accesosHoja = 0;

function rangoDe(matriz, fila, col, nFilas, nCols) {
  accesosHoja++;
  return {
    getValues() {
      const salida = [];
      for (let i = 0; i < nFilas; i++) {
        const origen = matriz[fila - 1 + i] || [];
        const linea = [];
        for (let j = 0; j < nCols; j++) linea.push(origen[col - 1 + j] ?? '');
        salida.push(linea);
      }
      return salida;
    },
    setNumberFormat(formato) {
      this.texto = formato === '@';
      return this;
    },
    setValue(v) {
      return this.setValues([[v]]);
    },
    setValues(valores) {
      valores.forEach((linea, i) => {
        while (matriz.length < fila + i) matriz.push([]);
        linea.forEach((v, j) => { matriz[fila - 1 + i][col - 1 + j] = this.texto ? v : comoLoHaceSheets(v); });
      });
      return this;
    },
  };
}

/**
 * Imita lo que hace Google Sheets con una celda de formato automático: convierte
 * lo que parece fecha u hora en un Date, en la zona horaria de la hoja. Aquí la
 * hoja está nueve horas "por detrás", como la copia de pruebas real el
 * 13/09/2026: si el backend escribe sin formato de texto, las pruebas lo pillan.
 */
function comoLoHaceSheets(v) {
  if (typeof v !== 'string') return v;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (m) return new Date(+m[1], m[2] - 1, +m[3], +m[4] + 9, +m[5]);
  m = v.match(/^(\d{2}):(\d{2})$/);
  if (m) return new Date(1899, 11, 30, +m[1] + 9, +m[2]);
  return v;
}

function hojaSimulada(nombre, matriz) {
  return {
    getName: () => nombre,
    getLastRow: () => matriz.length,
    getLastColumn: () => matriz.reduce((m, f) => Math.max(m, f.length), 0),
    getRange: (f, c, nf = 1, nc = 1) => rangoDe(matriz, f, c, nf, nc),
    appendRow: (fila) => matriz.push(fila.map(comoLoHaceSheets)),
  };
}

/** Una carpeta de Drive simulada, para el menú del comedor. */
const archivoSimulado = (nombre, fecha, bytes, tipo) => ({
  getName: () => nombre,
  getLastUpdated: () => new Date(fecha),
  getBlob: () => ({ getBytes: () => bytes, getContentType: () => tipo }),
});
const carpetaMenusSimulada = [
  archivoSimulado('2026-10.png', '2026-09-20T10:00:00Z', [1, 2, 3], 'image/png'),
  archivoSimulado('2026-09.jpg', '2026-09-01T10:00:00Z', [255, 216, 255], 'image/jpeg'),
  archivoSimulado('notas.txt', '2026-09-01T10:00:00Z', [0], 'text/plain'),
];

const contexto = {
  console,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({
      getSheetByName: (n) => (hojas[n] ? hojaSimulada(n, hojas[n]) : null),
      getSheets: () => Object.keys(hojas).map((n) => hojaSimulada(n, hojas[n])),
    }),
  },
  CalendarApp: { getCalendarById: () => null },
  DriveApp: {
    getFolderById: (id) => {
      if (id !== 'carpeta_prueba') throw new Error('No se encuentra ningún elemento con el ID ' + id);
      const archivos = carpetaMenusSimulada.slice();
      return { getFiles: () => ({ hasNext: () => archivos.length > 0, next: () => archivos.shift() }) };
    },
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: () => null,
      setProperty: () => {},
    }),
  },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ContentService: { createTextOutput: (t) => ({ setMimeType: () => t }), MimeType: { JSON: 'json' } },
  Utilities: {
    getUuid: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    base64Encode: (bytes) => Buffer.from(bytes.map((b) => b & 255)).toString('base64'),
    formatDate(fecha, zona, formato) {
      const p = (n) => String(n).padStart(2, '0');
      const s = {
        'yyyy-MM-dd': `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`,
        'HH:mm': `${p(fecha.getHours())}:${p(fecha.getMinutes())}`,
        yyyyMMdd: `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}`,
      };
      if (formato === 'yyyy-MM-dd HH:mm') return s['yyyy-MM-dd'] + ' ' + s['HH:mm'];
      return s[formato] || fecha.toISOString();
    },
  },
};
vm.createContext(contexto);

const base = path.join(__dirname, '..', 'apps-script');
['tablas.gs', 'acciones.gs', 'agenda.gs', 'custodia.gs', 'menus.gs', 'Codigo.gs'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(base, f), 'utf8'), contexto, { filename: f });
});

// ── las comprobaciones ────────────────────────────────────────────────

let fallos = 0;
function comprobar(titulo, obtenido, esperado) {
  const ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? '  ok  ' : ' FALLO'} │ ${titulo}`);
  if (!ok) console.log(`        esperado ${JSON.stringify(esperado)}\n        obtenido ${JSON.stringify(obtenido)}`);
}

let accesosUltimaAgenda = 0;
const agenda = (f) => {
  vm.runInContext('olvidarLecturas()', contexto); // cada petición empieza de cero
  const antes = accesosHoja;
  const resultado = vm.runInContext(`accionAgenda({fecha:'${f}'})`, contexto);
  accesosUltimaAgenda = accesosHoja - antes;
  return resultado;
};
const de = (a, nombre) => a.ninos.filter((n) => n.nombre === nombre)[0];

console.log('\nMARTES 6 de octubre de 2026');
const martes = agenda('2026-10-06');
comprobar('día de la semana es martes (2)', martes.dia_semana, 2);
comprobar(`la agenda lee cada pestaña una vez: ${accesosUltimaAgenda} accesos a la hoja (antes, 96)`,
  accesosUltimaAgenda <= 40, true);

const nino1Ma = de(martes, 'Niño1');
comprobar('el martes de Niño1 son ocho franjas, en orden',
  nino1Ma.clases.map((c) => c.hora_inicio), ['09:00', '10:00', '10:30', '11:00', '12:00', '13:00', '15:00', '16:00']);
comprobar('…y la de chándal es Educación física',
  nino1Ma.clases.filter((c) => c.equipamiento).map((c) => [c.asignatura, c.equipamiento]), [['Educación física', 'CH']]);
comprobar('Niño1 se recoge a las 18:00 por Fútbol', [nino1Ma.recogida.hora, nino1Ma.recogida.actividad], ['18:00', "Fútbol"]);
comprobar('Niño1: mañana chándal y piscina', nino1Ma.equipamiento_manana.map((e) => e.codigo).sort(), ['CH', 'PS']);

const nina2Ma = de(martes, 'Niña2');
comprobar('Niña2 se recoge a las 18:15 por Gimnasia', [nina2Ma.recogida.hora, nina2Ma.recogida.actividad], ['18:15', 'Gimnasia']);
comprobar('Niña2: mañana no lleva nada especial', nina2Ma.equipamiento_manana, []);

console.log('\nVIERNES 2 de octubre de 2026 — la robótica es a mediodía');
const viernes = agenda('2026-10-02');
const nino1Vi = de(viernes, 'Niño1');
comprobar('Niño1 sale a la hora normal, 17:00', nino1Vi.recogida.hora, '17:00');
comprobar('…y por la puerta principal', nino1Vi.recogida.lugar, 'Principal');
comprobar('el motivo es la salida ordinaria', nino1Vi.recogida.motivo, 'salida_ordinaria');

const nina2Vi = de(viernes, 'Niña2');
comprobar('Niña2 sale a las 17:00', nina2Vi.recogida.hora, '17:00');
comprobar('Niña2 acaba el viernes con Rincones y Psicomotricidad',
  nina2Vi.clases.slice(-2).map((c) => [c.hora_inicio, c.asignatura, c.hora_fin]),
  [['15:00', 'Rincones', '16:00'], ['16:00', 'Psicomotricidad', '17:00']]);
comprobar('Niño1: el jueves toca preparar chándal para el viernes',
  de(agenda('2026-10-08'), 'Niño1').equipamiento_manana.map((e) => e.codigo), ['CH']);

console.log('\nLUNES 28 de septiembre — las extraescolares aún no han empezado');
const antes = de(agenda('2026-09-29'), 'Niña2'); // martes anterior al 01/10
comprobar('Niña2 sale a la hora normal, sin gimnasia', antes.recogida.motivo, 'salida_ordinaria');

console.log('\nDOMINGO 4 de octubre');
const domingo = de(agenda('2026-10-04'), 'Niño1');
comprobar('no hay recogida en fin de semana', domingo.recogida.hay, false);

console.log('\nLUNES 12 de octubre — festivo en calendario_escolar');
const festivo = de(agenda('2026-10-12'), 'Niño1');
comprobar('no hay recogida en festivo', [festivo.recogida.hay, festivo.recogida.motivo], [false, 'festivo']);
comprobar('en festivo no sale ninguna clase', festivo.clases, []);
comprobar('en fin de semana tampoco', domingo.clases, []);

console.log('\nbootstrap');
const boot = vm.runInContext("accionBootstrap('per_papa')", contexto);
comprobar('devuelve los dos niños', boot.ninos.map((n) => n.nombre), ['Niño1', 'Niña2']);
comprobar('devuelve las cinco extraescolares', boot.extraescolares.length, 5);
comprobar('las listas traen los tipos de registro', boot.listas.registro_tipo.length, 13);
comprobar('la versión de esquema es la 1', String(boot.version_esquema), '1');
const senal = JSON.parse(vm.runInContext('doGet()', contexto));
comprobar('la URL dice qué versión del backend sirve',
  [senal.ok, typeof senal.version_backend, boot.version_backend === senal.version_backend], [true, 'string', true]);

console.log('\nescrituras — la cola del móvil puede reenviar lo mismo');
const ejecutar = (codigo) => vm.runInContext(codigo, contexto);
const cuantas = (tabla) => ejecutar(`leerTabla('${tabla}').filas.length`);
const fila = (tabla, id) => ejecutar(`leerTabla('${tabla}').filas.filter((f) => f.id === '${id}')[0]`);
const regAntes = cuantas('registro_nino');
const logAntes = cuantas('log');

contexto.apunte = {
  id: 'reg_20261006_prb1', creado_en: '2026-10-06 21:40', fecha: '2026-10-06', hora: '21:40',
  nino_id: 'nin_nina2', tipo: 'caca', valor: 'no', casa_persona_id: 'per_papa',
};
const creado = ejecutar("accionCreate({ tabla: 'registro_nino', datos: apunte }, 'per_papa')");
comprobar('crear respeta el id que genera la app', creado.registro.id, 'reg_20261006_prb1');
comprobar('el "no" se guarda como "no"', fila('registro_nino', 'reg_20261006_prb1').valor, 'no');
comprobar('autor_id sale del token si no se corrige', fila('registro_nino', 'reg_20261006_prb1').autor_id, 'per_papa');
comprobar('la hora y la marca se leen igual que se escribieron',
  [fila('registro_nino', 'reg_20261006_prb1').hora, fila('registro_nino', 'reg_20261006_prb1').creado_en],
  ['21:40', '2026-10-06 21:40']);

const reintento = ejecutar(
  "accionSync({ operaciones: [{ accion: 'create', tabla: 'registro_nino', datos: apunte, idLocal: 'l1' }] }, 'per_papa')");
comprobar('reenviar el mismo apunte no lo duplica',
  [reintento.resultados[0].ok, reintento.resultados[0].registro.id, cuantas('registro_nino') - regAntes],
  [true, 'reg_20261006_prb1', 1]);
comprobar('…ni deja otra línea en el log', cuantas('log') - logAntes, 1);

contexto.otro = Object.assign({}, contexto.apunte, { nino_id: 'nin_nino1', valor: 'si' });
const choque = ejecutar(
  "accionSync({ operaciones: [{ accion: 'create', tabla: 'registro_nino', datos: otro, idLocal: 'l2' }] }, 'per_mama')");
comprobar('mismo id con otros datos se guarda con id nuevo',
  [choque.resultados[0].registro.id !== 'reg_20261006_prb1', cuantas('registro_nino') - regAntes], [true, 2]);

const deshacer = ejecutar(`accionSync({ operaciones: [
  { accion: 'delete', tabla: 'registro_nino', id: 'reg_20261006_prb1', idLocal: 'l3' },
  { accion: 'delete', tabla: 'registro_nino', id: 'reg_20261006_prb1', idLocal: 'l4' },
  { accion: 'create', tabla: 'no_existe', datos: {}, idLocal: 'l5' },
] }, 'per_papa')`);
comprobar('una operación mala no tumba a las demás', deshacer.resultados.map((r) => r.ok), [true, true, false]);
comprobar('deshacer rellena eliminado_en y la fila sigue ahí',
  [!!fila('registro_nino', 'reg_20261006_prb1').eliminado_en, cuantas('registro_nino') - regAntes], [true, 2]);
comprobar('borrar dos veces no cambia la marca',
  deshacer.resultados[1].registro.eliminado_en, deshacer.resultados[0].registro.eliminado_en);
comprobar('en el log: dos altas y un solo borrado', cuantas('log') - logAntes, 3);

ejecutar(`accionSync({ operaciones: [{ accion: 'update', tabla: 'registro_nino', id: 'reg_20261006_prb1',
  datos: { valor: 'si', eliminado_en: '' }, idLocal: 'l6' }] }, 'per_mama')`);
comprobar('el borrado gana: editar lo borrado no cambia nada ni lo desborra',
  [fila('registro_nino', 'reg_20261006_prb1').valor, !!fila('registro_nino', 'reg_20261006_prb1').eliminado_en, cuantas('log') - logAntes],
  ['no', true, 3]);

contexto.menu = { id: 'men_20261006_prb1', fecha: '2026-10-06', casa_persona_id: 'per_papa', cena: 'Tortilla' };
ejecutar("accionCreate({ tabla: 'menu_casa', datos: menu }, 'per_papa')");
ejecutar("accionUpdate({ tabla: 'menu_casa', id: 'men_20261006_prb1', datos: { cena: 'Tortilla', fruta: 'Pera' } }, 'per_mama')");
comprobar('editar el menú de la casa cambia solo lo cambiado',
  [fila('menu_casa', 'men_20261006_prb1').cena, fila('menu_casa', 'men_20261006_prb1').fruta, cuantas('log') - logAntes],
  ['Tortilla', 'Pera', 5]);

console.log('\nmenú del comedor en imagen');
const pedir = (codigo) => { vm.runInContext('olvidarLecturas()', contexto); return vm.runInContext(codigo, contexto); };
comprobar('sin carpeta_menus en config lo dice', pedir('accionMenusComedor()').error, 'sin_carpeta_menus');
hojas.config.push(['carpeta_menus', 'carpeta_prueba', '']);
comprobar('lista los meses con imagen, en orden y sin otros ficheros',
  pedir('accionMenusComedor()').menus.map((m) => m.mes), ['2026-09', '2026-10']);
const septiembre = pedir("accionMenuImagen({ mes: '2026-09' })");
comprobar('manda la imagen del mes en base64, con su tipo',
  [septiembre.hay, septiembre.tipo, septiembre.base64], [true, 'image/jpeg', '/9j/']);
comprobar('no la vuelve a mandar si el móvil ya tiene esa versión',
  pedir(`accionMenuImagen({ mes: '2026-09', actualizado: '${septiembre.actualizado}' })`).sin_cambios, true);
const noviembre = pedir("accionMenuImagen({ mes: '2026-11' })");
comprobar('un mes sin imagen no es un error', [noviembre.ok, noviembre.hay], [true, false]);
hojas.config[hojas.config.length - 1][1] = 'otra_carpeta';
comprobar('una carpeta que no se puede abrir da un error claro',
  pedir('accionMenusComedor()').error, 'carpeta_menus_inaccesible');

console.log(fallos === 0 ? '\nTodo correcto.\n' : `\n${fallos} comprobaciones fallidas.\n`);
process.exit(fallos ? 1 : 0);
