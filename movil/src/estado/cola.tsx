/**
 * La cola vista desde la interfaz: cuántas cosas faltan por subir, y cuándo
 * intentarlo.
 *
 * Se intenta subir al abrir la app, al volver a ella, justo después de apuntar
 * y, mientras quede algo, cada 30 segundos. No se reintenta en cada cambio de la
 * cola: un apunte que el backend rechaza siempre acabaría en un bucle.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useSesion } from './sesion';
import { pendientes, suscribir, vaciar } from '../db/cola';

const CADA = 30000;

interface EstadoCola {
  /** Cambia cada vez que cambia la cola: sirve para volver a pintar. */
  version: number;
  pendientes: number;
  subir: () => Promise<void>;
}

const Contexto = createContext<EstadoCola | null>(null);

export function ProveedorCola({ children }: { children: React.ReactNode }) {
  const { credenciales } = useSesion();
  const [version, setVersion] = useState(0);

  useEffect(() => suscribir(() => setVersion((v) => v + 1)), []);

  const subir = useCallback(async () => {
    if (credenciales) await vaciar(credenciales);
  }, [credenciales]);

  useEffect(() => {
    subir();
    const alVolver = AppState.addEventListener('change', (e) => { if (e === 'active') subir(); });
    const reloj = setInterval(() => { if (pendientes().length) subir(); }, CADA);
    return () => { alVolver.remove(); clearInterval(reloj); };
  }, [subir]);

  return (
    <Contexto.Provider value={{ version, pendientes: pendientes().length, subir }}>
      {children}
    </Contexto.Provider>
  );
}

export function useCola() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useCola tiene que usarse dentro de ProveedorCola');
  return c;
}
