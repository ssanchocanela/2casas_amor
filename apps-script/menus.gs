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
