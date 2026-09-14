/**
 * Las imágenes del menú del comedor, guardadas en el móvil.
 *
 * Una por mes, en la carpeta de documentos de la app. El nombre lleva la versión
 * (la fecha en que se actualizó en Drive), así que una imagen nueva nunca se
 * confunde con la vieja. Es caché: se puede perder y se vuelve a descargar.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { recordar, recuperar } from './cache';

export interface MenuGuardado {
  mes: string;
  uri: string;
  actualizado: string;
  tipo: string;
}

const clave = (mes: string) => `menu_imagen:${mes}`;
const EXTENSION: Record<string, string> = { 'image/png': 'png', 'image/webp': 'webp' };

/** Lo que hay guardado de ese mes, si el fichero sigue ahí. */
export function menuGuardado(mes: string): MenuGuardado | null {
  const guardado = recuperar<MenuGuardado>(clave(mes));
  if (!guardado) return null;
  try {
    return new File(guardado.uri).exists ? guardado : null;
  } catch {
    return null;
  }
}

export function guardarMenu(mes: string, base64: string, tipo: string, actualizado: string): MenuGuardado {
  const carpeta = new Directory(Paths.document, 'menus');
  if (!carpeta.exists) carpeta.create({ intermediates: true });

  const archivo = new File(carpeta, `${mes}-${actualizado.replace(/\D/g, '')}.${EXTENSION[tipo] ?? 'jpg'}`);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(base64, { encoding: 'base64' });

  // La versión anterior de ese mes ya no sirve.
  const anterior = recuperar<MenuGuardado>(clave(mes));
  if (anterior && anterior.uri !== archivo.uri) {
    try {
      const viejo = new File(anterior.uri);
      if (viejo.exists) viejo.delete();
    } catch {}
  }

  const guardado = { mes, uri: archivo.uri, actualizado, tipo };
  recordar(clave(mes), guardado);
  return guardado;
}
