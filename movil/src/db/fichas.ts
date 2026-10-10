/**
 * Guardar tareas, lecturas y eventos.
 *
 * Igual que los apuntes: todo entra en la cola, se pinta al instante y sube
 * cuando hay red. El alta y la edición ofrecen deshacer.
 *
 * El borrado no: el backend lo hace lógico (rellena `eliminado_en`) y no
 * admite "desborrar" —lo borrado no se edita, es la regla—, así que un
 * deshacer que a veces funcionara sería peor que no tenerlo. Por eso borrar
 * pide confirmación antes, y es el único sitio de la app donde se pregunta.
 */

import type { Deshacer } from './apuntar';
import { encolar } from './cola';
import {
  FICHAS, nuevoIdFicha, type TablaFicha, type Valores,
} from '../domain/fichas';
import { hoyMadrid } from '../domain/fechas';

/** Lo vacío no se manda al crear: 'autor_id' y 'creado_en' los pone el backend. */
const sinVacios = (v: Valores) =>
  Object.fromEntries(Object.entries(v).filter(([, t]) => t !== '' && t !== undefined && t !== null));

export interface Alta { deshacer: Deshacer; id: string }

export function crearFicha(tabla: TablaFicha, valores: Valores): Alta {
  const fecha = valores[FICHAS[tabla].columnaFecha] || hoyMadrid();
  const id = nuevoIdFicha(tabla, fecha);
  // El id viaja dentro de los datos: es lo que hace que un reenvío de la cola
  // no cree una fila repetida (el backend reconoce el id y no duplica).
  const datos: Valores = { ...sinVacios(valores), id };
  // Una tarea se apunta el día que la mandan, salvo que se diga otra cosa.
  if (tabla === 'tareas' && !datos.fecha_asignada) datos.fecha_asignada = hoyMadrid();

  const [idLocal] = encolar([{ accion: 'create', tabla, registro_id: id, datos }]);
  return {
    id,
    deshacer: { pasos: [{ idLocal, contraria: { accion: 'delete', tabla, registro_id: id, datos: {} } }] },
  };
}

/**
 * Solo se manda lo que ha cambiado, para no pisar lo que haya tocado el otro
 * en la hoja mientras tanto. Devuelve null si no había nada que guardar.
 */
export function editarFicha(
  tabla: TablaFicha, id: string, antes: Valores, cambios: Valores,
): Deshacer | null {
  const claves = Object.keys(cambios);
  if (!claves.length) return null;
  const contrarios = Object.fromEntries(claves.map((k) => [k, antes[k] ?? '']));
  const [idLocal] = encolar([{ accion: 'update', tabla, registro_id: id, datos: cambios }]);
  return { pasos: [{ idLocal, contraria: { accion: 'update', tabla, registro_id: id, datos: contrarios } }] };
}

/** Borrado lógico, sin vuelta atrás. Quien llama ya ha preguntado. */
export function borrarFicha(tabla: TablaFicha, id: string) {
  encolar([{ accion: 'delete', tabla, registro_id: id, datos: {} }]);
}
