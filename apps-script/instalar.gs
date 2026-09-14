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
