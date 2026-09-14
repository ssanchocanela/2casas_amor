/**
 * Vuelca el horario de clases del curso en la pestaña horario_lectivo, a través
 * del backend: con su bloqueo, su log y columnas por nombre, sin tocar la hoja
 * a mano.
 *
 *   node scripts/cargar_horario.js --pruebas   en la copia, con movil/.env.local
 *   node scripts/cargar_horario.js             pregunta la URL y el token (la hoja buena)
 *
 * Los datos salen de scripts/datos/horario_lectivo_2026-2027.json, el mismo
 * fichero con el que generar_hoja.py rellena la plantilla. Se puede ejecutar
 * las veces que haga falta: no duplica nada. Las clases de ese curso que ya no
 * están en el fichero no se borran: se marcan con activo = no.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const RAIZ = path.join(__dirname, '..');
const DATOS = JSON.parse(fs.readFileSync(path.join(__dirname, 'datos', 'horario_lectivo_2026-2027.json'), 'utf8'));
const TANDA = 20;

/** El JSON compacto, convertido en filas de horario_lectivo. */
function filasDelHorario(datos) {
  const filas = [];
  Object.entries(datos.ninos).forEach(([ninoId, nino]) => {
    Object.entries(nino.dias).forEach(([dia, clases]) => {
      clases.forEach(([hora, asignatura, equipamiento], i) => {
        filas.push({
          id: `hor_${ninoId.replace(/^nin_/, '')}_${dia}_${hora.replace(':', '')}`,
          nino_id: ninoId,
          curso_escolar: datos.curso_escolar,
          dia_semana: dia,
          orden: String(i + 1),
          hora_inicio: hora,
          hora_fin: i + 1 < clases.length ? clases[i + 1][0] : nino.salida,
          asignatura,
          equipamiento: equipamiento || '',
          activo: 'si',
        });
      });
    });
  });
  return filas;
}

function credencialesDePruebas() {
  const env = Object.fromEntries(
    fs.readFileSync(path.join(RAIZ, 'movil', '.env.local'), 'utf8').split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
  );
  return { url: env.PRUEBAS_URL_BACKEND, token: env.PRUEBAS_TOKEN };
}

function preguntar(texto) {
  return new Promise((resolver) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(texto, (respuesta) => { rl.close(); resolver(respuesta.trim()); });
  });
}

async function llamar(cred, accion, datos) {
  const r = await fetch(cred.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: cred.token, accion, datos }),
  });
  const cuerpo = JSON.parse(await r.text());
  if (cuerpo.ok === false) throw new Error(`${accion}: ${cuerpo.mensaje || cuerpo.error}`);
  return cuerpo;
}

(async () => {
  const pruebas = process.argv.includes('--pruebas');
  const cred = pruebas
    ? credencialesDePruebas()
    : { url: await preguntar('URL de la implementación: '), token: await preguntar('Token: ') };

  const base = await llamar(cred, 'bootstrap', {});
  console.log(`Hoja: entorno ${base.config.entorno}, curso ${base.config.curso_escolar}, backend ${base.version_backend}.`);
  if (pruebas && base.config.entorno !== 'pruebas') {
    console.error('Has pedido --pruebas, pero esa hoja no es la copia de pruebas. No se escribe nada.');
    process.exit(1);
  }

  const nuevas = filasDelHorario(DATOS);
  const ids = new Set(nuevas.map((f) => f.id));
  const existentes = (await llamar(cred, 'list', { tabla: 'horario_lectivo' })).filas;
  const porId = new Map(existentes.map((f) => [f.id, f]));

  const crear = nuevas.filter((f) => !porId.has(f.id));
  const cambiar = nuevas.filter((f) => porId.has(f.id) &&
    Object.keys(f).some((k) => String(porId.get(f.id)[k] ?? '') !== String(f[k])));
  const retirar = existentes.filter((f) =>
    f.curso_escolar === DATOS.curso_escolar && f.activo !== 'no' && !ids.has(f.id));

  console.log(`${crear.length} clases nuevas, ${cambiar.length} cambiadas y ${retirar.length} viejas que pasan a activo = no.`);
  retirar.forEach((f) => console.log(`  retirar: ${f.id} (${f.asignatura})`));
  if (!crear.length && !cambiar.length && !retirar.length) {
    console.log('El horario ya está al día.');
    return;
  }
  if (!pruebas && (await preguntar('Escribe "si" para escribir en esta hoja: ')) !== 'si') {
    console.log('No se escribe nada.');
    return;
  }

  const operaciones = [
    ...crear.map((f) => ({ accion: 'create', tabla: 'horario_lectivo', id: f.id, datos: f, idLocal: `c_${f.id}` })),
    ...cambiar.map((f) => ({ accion: 'update', tabla: 'horario_lectivo', id: f.id, datos: f, idLocal: `u_${f.id}` })),
    ...retirar.map((f) => ({ accion: 'update', tabla: 'horario_lectivo', id: f.id, datos: { activo: 'no' }, idLocal: `r_${f.id}` })),
  ];
  let fallos = 0;
  // En tandas, para quedar lejos del límite de seis minutos por ejecución del script.
  for (let i = 0; i < operaciones.length; i += TANDA) {
    const { resultados } = await llamar(cred, 'sync', { operaciones: operaciones.slice(i, i + TANDA) });
    resultados.filter((r) => !r.ok).forEach((r) => { fallos++; console.error(`  FALLO ${r.idLocal}: ${r.error}`); });
    console.log(`  ${Math.min(i + TANDA, operaciones.length)} de ${operaciones.length}`);
  }
  console.log(fallos ? `${fallos} operaciones han fallado.` : 'Horario cargado.');
  process.exit(fallos ? 1 : 0);
})().catch((err) => {
  console.error(String(err));
  process.exit(1);
});
