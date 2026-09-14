/**
 * El menú del comedor en imagen, desde la app: qué meses hay y la imagen de uno.
 *
 * Todo pasa por el script con el token, sin cuenta de Google. La imagen se
 * guarda en el móvil y se pinta desde ahí: sin red se ve la última descargada.
 */

import { menuImagen, menusComedor } from '../api/cliente';
import { guardarMenu, menuGuardado } from '../db/menus';
import type { RespuestaMenuImagen, RespuestaMenusComedor } from '../domain/tipos';
import { useLectura } from './lectura';
import { useSesion } from './sesion';

/** Los meses ('AAAA-MM') que tienen imagen en la carpeta. La lista se guarda. */
export function useMenusComedor() {
  const { credenciales } = useSesion();
  const lectura = useLectura<RespuestaMenusComedor>(
    credenciales ? 'menus_comedor' : null,
    () => menusComedor(credenciales!),
  );
  return { meses: lectura.datos?.menus.map((m) => m.mes) ?? [], estado: lectura.estado, mensaje: lectura.mensaje };
}

/**
 * La imagen de un mes. Se pide diciendo qué versión hay ya en el móvil: si no ha
 * cambiado, el backend no la vuelve a mandar.
 */
export function useMenuImagen(mes: string) {
  const { credenciales } = useSesion();
  const lectura = useLectura<RespuestaMenuImagen>(
    credenciales ? `menu_imagen:${mes}:peticion` : null,
    () => menuImagen(credenciales!, mes, menuGuardado(mes)?.actualizado),
    {
      // La respuesta trae la imagen entera: se guarda como fichero, no en la base.
      guardar: false,
      alRecibir: (r) => {
        if (r.hay && r.base64 && r.actualizado) guardarMenu(mes, r.base64, r.tipo ?? 'image/jpeg', r.actualizado);
      },
    },
  );
  const noHay = lectura.datos ? !lectura.datos.hay : false;
  return {
    uri: noHay ? null : menuGuardado(mes)?.uri ?? null,
    noHay,
    estado: lectura.estado,
    mensaje: lectura.mensaje,
  };
}
