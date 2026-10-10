/**
 * Leer sin esperar a la red.
 *
 * useLectura pinta al instante lo último guardado en el móvil y pide lo nuevo
 * por detrás: al montarse, al volver a la app y, mientras falle, cada 30
 * segundos. Si dos pantallas piden lo mismo a la vez, sale una sola petición.
 *
 * useFilas hace lo mismo con las filas de una pestaña en un rango de fechas,
 * que quedan guardadas una a una en la caché (src/db/cache.ts).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ErrorApi, listar } from '../api/cliente';
import { guardarFilas, leerFilas, recordar, recuperar, type Rango } from '../db/cache';
import { useSesion } from './sesion';
import { useCola } from './cola';

const REINTENTO = 30000;

export type EstadoLectura = 'cargando' | 'al_dia' | 'sin_red' | 'lento' | 'error';

interface Opciones<T> {
  /** Con cada respuesta buena, y la hora a la que salió la petición. */
  alRecibir?: (datos: T, pedidoEn: number) => void;
  /** false: no guardar la respuesta entera, porque quien la recibe guarda lo suyo. */
  guardar?: boolean;
}

const enVuelo = new Map<string, { promesa: Promise<unknown>; en: number }>();

export function useLectura<T>(clave: string | null, pedir: () => Promise<T>, opciones: Opciones<T> = {}) {
  const guardar = opciones.guardar !== false;
  const [datos, setDatos] = useState<T | null>(() => (clave && guardar ? recuperar<T>(clave) : null));
  const [estado, setEstado] = useState<EstadoLectura>('cargando');
  const [mensaje, setMensaje] = useState<string | null>(null);

  const actual = useRef({ clave, pedir, opciones });
  actual.current = { clave, pedir, opciones };

  // Otra clave (otro día, otro niño): se pinta lo guardado de esa clave.
  const claveAnterior = useRef(clave);
  useEffect(() => {
    if (claveAnterior.current === clave) return;
    claveAnterior.current = clave;
    setDatos(clave && guardar ? recuperar<T>(clave) : null);
    setEstado('cargando');
  }, [clave, guardar]);

  const refrescar = useCallback(async () => {
    if (!clave) return;
    let vuelo = enVuelo.get(clave);
    if (!vuelo) {
      const promesa = actual.current.pedir();
      vuelo = { promesa, en: Date.now() };
      enVuelo.set(clave, vuelo);
      promesa.then(() => enVuelo.delete(clave), () => enVuelo.delete(clave));
    }
    try {
      const nuevos = (await vuelo.promesa) as T;
      if (actual.current.clave !== clave) return;
      if (guardar) recordar(clave, nuevos);
      actual.current.opciones.alRecibir?.(nuevos, vuelo.en);
      setDatos(nuevos);
      setEstado('al_dia');
      setMensaje(null);
    } catch (e) {
      if (actual.current.clave !== clave) return;
      const codigo = e instanceof ErrorApi ? e.codigo : '';
      setEstado(codigo === 'sin_conexion' ? 'sin_red' : codigo === 'lento' ? 'lento' : 'error');
      setMensaje(e instanceof ErrorApi ? e.message : 'No se ha podido cargar.');
    }
  }, [clave, guardar]);

  useEffect(() => { refrescar(); }, [refrescar]);

  useEffect(() => {
    const alVolver = AppState.addEventListener('change', (e) => { if (e === 'active') refrescar(); });
    return () => alVolver.remove();
  }, [refrescar]);

  useEffect(() => {
    if (estado === 'cargando' || estado === 'al_dia') return;
    const reloj = setInterval(refrescar, REINTENTO);
    return () => clearInterval(reloj);
  }, [estado, refrescar]);

  return { datos, estado, mensaje, refrescar };
}

/**
 * Las filas de una pestaña en un rango, desde la caché, refrescadas por detrás.
 * Con 'activo' a false no se pide nada (una capa apagada del calendario), pero
 * se sigue devolviendo lo que haya guardado.
 */
export function useFilas<T extends { id: string }>(tabla: string, rango: Rango, activo = true) {
  const { credenciales } = useSesion();
  const { pendientes } = useCola(); // se vuelve a pintar cuando cambia la cola
  const { desde, hasta, nino } = rango;
  const lectura = useLectura(
    credenciales && activo ? `filas:${tabla}:${desde}:${hasta}:${nino ?? ''}` : null,
    () => listar<T>(credenciales!, tabla, { desde, hasta, ...(nino ? { nino } : {}) }),
    { guardar: false, alRecibir: (r) => guardarFilas(tabla, { desde, hasta, nino }, r.filas) },
  );

  // Al vaciarse la cola hay que volver a leer: lo recién subido deja de estar
  // en la cola y, en cuanto Hoy olvida lo confirmado, desaparecería de la
  // pantalla hasta la siguiente lectura.
  const { refrescar } = lectura;
  const pendientesAntes = useRef(pendientes);
  useEffect(() => {
    if (pendientes < pendientesAntes.current) refrescar();
    pendientesAntes.current = pendientes;
  }, [pendientes, refrescar]);

  return { filas: leerFilas<T>(tabla, rango), estado: lectura.estado, refrescar };
}
