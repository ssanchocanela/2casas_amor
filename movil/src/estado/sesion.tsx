/**
 * La sesión: la dirección del backend, el token y quién soy.
 *
 * El token se guarda en expo-secure-store, que en Android es el Keystore del
 * sistema. Nunca en AsyncStorage y nunca en el código.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { olvidarCache, recordar, recuperar } from '../db/cache';
import type { Credenciales } from '../api/cliente';
import { bootstrap, probarConexion } from '../api/cliente';
import type {
  Clase, Extraescolar, HorarioCentro, Nino, Persona, PersonaId, RespuestaBootstrap,
} from '../domain/tipos';

const CLAVE_URL = 'url_backend';
const CLAVE_TOKEN = 'token';
/** Los datos base, en la base local: sin red, la app sigue sabiendo quién es quién. */
const CLAVE_BOOTSTRAP = 'bootstrap';
const REINTENTO = 30000;

/** La versión de esquema que esta app sabe leer. */
export const ESQUEMA_ESPERADO = '1';

interface Sesion {
  cargando: boolean;
  credenciales: Credenciales | null;
  yo: PersonaId | null;
  personas: Persona[];
  ninos: Nino[];
  /** Lo fijo del curso, de los datos base: horario del centro, clases y extraescolares. */
  horarioCentro: HorarioCentro[];
  horarioLectivo: Clase[];
  extraescolares: Extraescolar[];
  config: Record<string, string>;
  avisoEsquema: string | null;
  entrar: (cred: Credenciales) => Promise<void>;
  salir: () => Promise<void>;
  refrescar: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);
  const [yo, setYo] = useState<PersonaId | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [ninos, setNinos] = useState<Nino[]>([]);
  const [horarioCentro, setHorarioCentro] = useState<HorarioCentro[]>([]);
  const [horarioLectivo, setHorarioLectivo] = useState<Clase[]>([]);
  const [extraescolares, setExtraescolares] = useState<Extraescolar[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [avisoEsquema, setAvisoEsquema] = useState<string | null>(null);

  const aplicar = useCallback((datos: RespuestaBootstrap) => {
    setYo(datos.yo);
    setPersonas(datos.personas);
    setNinos(datos.ninos);
    setHorarioCentro(datos.horario_centro ?? []);
    setHorarioLectivo(datos.horario_lectivo ?? []);
    setExtraescolares(datos.extraescolares ?? []);
    setConfig(datos.config);
    setAvisoEsquema(
      String(datos.version_esquema) === ESQUEMA_ESPERADO
        ? null
        : `La hoja está en el esquema ${datos.version_esquema} y esta app espera ` +
          `el ${ESQUEMA_ESPERADO}. Puede que algo no se vea bien.`,
    );
  }, []);

  const cargarDatosBase = useCallback(async (cred: Credenciales) => {
    const datos = await bootstrap(cred);
    aplicar(datos);
    recordar(CLAVE_BOOTSTRAP, datos);
  }, [aplicar]);

  // Al arrancar, recuperar lo guardado e intentar conectar.
  useEffect(() => {
    (async () => {
      try {
        const url = await SecureStore.getItemAsync(CLAVE_URL);
        const token = await SecureStore.getItemAsync(CLAVE_TOKEN);
        if (url && token) {
          const cred = { url, token };
          setCredenciales(cred);
          // Primero lo último que se supo; luego, si hay red, lo de ahora.
          const guardado = recuperar<RespuestaBootstrap>(CLAVE_BOOTSTRAP);
          if (guardado) aplicar(guardado);
          // Si no hay red, la app entra igual: ya rellenará al reconectar.
          try {
            await cargarDatosBase(cred);
          } catch {}
        }
      } finally {
        setCargando(false);
      }
    })();
  }, [cargarDatosBase, aplicar]);

  // Si se arrancó sin red y sin nada guardado, se reintenta hasta tener los datos
  // base: sin ellos no se sabe quién apunta ni se puede corregir la casa.
  useEffect(() => {
    if (!credenciales || yo) return;
    const intentar = () => { cargarDatosBase(credenciales).catch(() => {}); };
    const reloj = setInterval(intentar, REINTENTO);
    const alVolver = AppState.addEventListener('change', (e) => { if (e === 'active') intentar(); });
    return () => { clearInterval(reloj); alVolver.remove(); };
  }, [credenciales, yo, cargarDatosBase]);

  const entrar = useCallback(async (cred: Credenciales) => {
    // probarConexion valida además la forma de la URL, para dar un error claro
    // cuando alguien pega la del editor del script en vez de la implementación.
    // Si falla, no se guarda nada: la pantalla de conexión muestra el motivo.
    const datos = await probarConexion(cred);
    aplicar(datos);
    recordar(CLAVE_BOOTSTRAP, datos);
    await SecureStore.setItemAsync(CLAVE_URL, cred.url);
    await SecureStore.setItemAsync(CLAVE_TOKEN, cred.token);
    setCredenciales(cred);
  }, [aplicar]);

  const salir = useCallback(async () => {
    await SecureStore.deleteItemAsync(CLAVE_URL);
    await SecureStore.deleteItemAsync(CLAVE_TOKEN);
    olvidarCache();
    setCredenciales(null);
    setYo(null);
    setPersonas([]);
    setNinos([]);
  }, []);

  const refrescar = useCallback(async () => {
    if (credenciales) await cargarDatosBase(credenciales);
  }, [credenciales, cargarDatosBase]);

  return (
    <Contexto.Provider value={{
      cargando, credenciales, yo, personas, ninos, config, avisoEsquema,
      horarioCentro, horarioLectivo, extraescolares,
      entrar, salir, refrescar,
    }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSesion() {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSesion tiene que usarse dentro de ProveedorSesion');
  return s;
}
