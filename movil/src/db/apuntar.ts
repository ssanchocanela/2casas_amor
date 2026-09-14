/**
 * Guardar y deshacer apuntes.
 *
 * Todo pasa por la cola: se pinta al instante y sube cuando hay red. No hay
 * diálogos de confirmación: se guarda y se ofrece deshacer unos segundos.
 */

import type { MenuCasa, RegistroNino } from '../domain/tipos';
import { cambiosMenu, type CamposMenu } from '../domain/apuntes';
import { encolar, idActual, retirar, type OperacionNueva } from './cola';

/** Lo necesario para deshacer un guardado: cada operación y su contraria. */
export interface Deshacer {
  pasos: { idLocal: string; contraria: OperacionNueva }[];
}

/**
 * Los campos vacíos no se mandan. En particular 'autor_id': si no se ha
 * corregido a mano, lo pone el backend a partir del token.
 */
const sinVacios = (o: object) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined && v !== null));

/** Una fila por hecho. "Los dos" llega aquí como dos registros. */
export function guardarRegistros(registros: RegistroNino[]): Deshacer {
  const ids = encolar(registros.map((r) => ({
    accion: 'create' as const, tabla: 'registro_nino', registro_id: r.id, datos: sinVacios(r),
  })));
  return {
    pasos: registros.map((r, i) => ({
      idLocal: ids[i],
      contraria: { accion: 'delete', tabla: 'registro_nino', registro_id: r.id, datos: {} },
    })),
  };
}

/**
 * Lo de la casa: si ya hay apunte de hoy en esa casa se edita, y solo se manda
 * lo que ha cambiado. Devuelve null si no había nada que guardar.
 */
export function guardarMenu(
  actual: MenuCasa | undefined, nuevo: MenuCasa, campos: CamposMenu,
): Deshacer | null {
  if (actual) {
    const cambios = cambiosMenu(actual, campos);
    const claves = Object.keys(cambios) as (keyof CamposMenu)[];
    if (!claves.length) return null;
    const antes = Object.fromEntries(claves.map((k) => [k, actual[k] ?? '']));
    const [idLocal] = encolar([{ accion: 'update', tabla: 'menu_casa', registro_id: actual.id, datos: cambios }]);
    return { pasos: [{ idLocal, contraria: { accion: 'update', tabla: 'menu_casa', registro_id: actual.id, datos: antes } }] };
  }
  const [idLocal] = encolar([{ accion: 'create', tabla: 'menu_casa', registro_id: nuevo.id, datos: sinVacios(nuevo) }]);
  return { pasos: [{ idLocal, contraria: { accion: 'delete', tabla: 'menu_casa', registro_id: nuevo.id, datos: {} } }] };
}

/**
 * Deshace de atrás hacia delante. Lo que aún no ha salido se retira de la cola
 * sin dejar rastro; lo que ya salió se contrarresta: un alta con un borrado
 * lógico, una edición con la edición contraria. Devuelve true si ha encolado
 * algo que hay que subir.
 */
export function deshacer(d: Deshacer): boolean {
  const contrarias = [...d.pasos]
    .reverse()
    .filter((p) => !retirar(p.idLocal))
    .map((p) => ({ ...p.contraria, registro_id: idActual(p.contraria.registro_id) }));
  if (contrarias.length) encolar(contrarias);
  return contrarias.length > 0;
}
