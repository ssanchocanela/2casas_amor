# Arrancar la app

Esta carpeta contiene **solo el código propio** de la app: los tipos, el cliente
de la API y las pantallas. No trae `package.json` ni dependencias, y es
deliberado: fijar aquí unas versiones concretas de Expo y React Native
garantizaría que estuvieran obsoletas dentro de dos meses. El andamiaje lo crea
Expo en el momento, con las versiones que sean buenas ese día.

## 1. Crear el proyecto Expo

Desde la raíz del repositorio:

```bash
npx create-expo-app@latest movil-temp --template default
```

La plantilla `default` ya viene con TypeScript y **Expo Router**, que es lo que
usan las pantallas de `app/`.

Después, fusiona: mueve de `movil-temp/` a `movil/` todo lo que `movil/` no
tenga (`package.json`, `app.json`, `tsconfig.json`, `.gitignore`, `assets/`…),
**sin pisar** las carpetas `app/` y `src/` que ya están escritas. Borra
`movil-temp/` y el `app/` de ejemplo que trae la plantilla.

## 2. Instalar lo que falta

```bash
cd movil
npx expo install expo-secure-store expo-status-bar
```

`expo install` en vez de `npm install`: elige la versión compatible con el SDK
de Expo que haya quedado instalado. Con `npm install` acabas con versiones que
no casan y errores difíciles de leer.

## 3. Configurar `app.json`

```json
{
  "expo": {
    "name": "2 Casas + Amor",
    "slug": "dos-casas",
    "scheme": "doscasas",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "android": {
      "package": "com.doscasas.app",
      "versionCode": 1
    },
    "plugins": ["expo-router", "expo-secure-store"]
  }
}
```

`scheme` es obligatorio con Expo Router. El `package` de Android no se cambia
nunca una vez instalada la app: para Android es su identidad.

## 4. Probar

```bash
npx expo start
```

Escanea el código QR con **Expo Go** desde el móvil. La app pedirá la dirección
del backend y el token; los mismos que se generaron en el Apps Script.

Si todo está bien, la pantalla **Hoy** debe mostrar a Niño1 y Niña2, quién los
tiene, la hora de recogida de hoy y qué hay que llevar mañana.

## 5. Generar el APK

El APK se firma con la **clave propia de la familia**, no con la de depuración
que trae la plantilla (esa es pública). La clave vive fuera del repositorio:

- `~/.doscasas/doscasas-release.keystore`
- sus contraseñas, en `~/.gradle/gradle.properties`: `DOSCASAS_KEYSTORE`,
  `DOSCASAS_KEYSTORE_PASSWORD`, `DOSCASAS_KEY_ALIAS` y `DOSCASAS_KEY_PASSWORD`

El plugin `plugins/firmaAndroid.js` hace que el build de release la use cuando
esas propiedades existen. **Guarda copia de esos dos ficheros fuera de este
ordenador.** Android solo instala una versión nueva encima de la anterior si va
firmada con la misma clave: sin ella habría que desinstalar la app en los
móviles, y se perdería lo que no hubiera subido. Por lo mismo, no uses
`eas build`: firmaría con otra clave.

Para compilar hacen falta el SDK de Android, el NDK 27.1.12297006, CMake 3.22.1
y Java 17:

```bash
cd movil
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
```

El APK queda en `movil/android/app/build/outputs/apk/release/app-release.apk`.
Se instala copiándolo al móvil y abriéndolo; Android pedirá permitir instalar
apps de ese origen. Para sacar una versión nueva, sube antes `android.versionCode`
en `app.json` (y `version`, si quieres): Android no instala encima un APK con
el mismo número o uno menor.

La primera vez que se abre, la app pide la dirección de la hoja buena y el
token de quien usa ese móvil. El APK no lleva ninguna credencial dentro.

---

## Qué hay escrito y qué falta

| | Estado |
|---|---|
| `src/domain/tipos.ts` | Hecho. Espejo del esquema de la hoja |
| `src/api/cliente.ts` | Hecho. Todas las acciones de la API |
| `src/estado/sesion.tsx` | Hecho. Credenciales en el Keystore, datos base |
| `app/conexion.tsx` | Hecho. Alta del móvil |
| `app/(tabs)/index.tsx` | Hecho. **Hoy**, la pantalla principal, con los iconos de lo apuntado como botones |
| `app/(tabs)/ajustes.tsx` | Hecho |
| `app/(tabs)/calendario.tsx` | Hecho. Mes y semana con la custodia de fondo, capas y recuento |
| `app/dia/[fecha].tsx`, `src/ui/dia/PantallaDia.tsx` | Hecho. Un día cualquiera con la misma pantalla que Hoy |
| `app/(tabs)/ninos.tsx` | Hecho. Día a día (rejilla semanal), colegio y salud |
| Apuntar (`src/ui/apuntar/`, `src/domain/apuntes.ts`) | Hecho |
| Fichas de tareas, lecturas, eventos, salud y medidas (`src/ui/fichas/`, `src/domain/fichas.ts`, `src/db/fichas.ts`) | Hechas. Se añaden y corrigen desde Niños → Colegio y Niños → Salud |
| La hoja que sube desde abajo (`src/ui/Hoja.tsx`, `src/ui/teclado.ts`) | Hecha. La comparten Apuntar y las fichas; aparta el teclado y la barra de Android |
| Menú del comedor en imagen (`app/menu/[mes].tsx`, `src/db/menus.ts`) | Hecho. Desde Hoy → Comedor |
| Cola sin conexión (`src/db/cola.ts`) | Hecha. Las escrituras suben con `sync` |
| Caché de lectura (`src/db/cache.ts`, `src/estado/lectura.ts`) | Hecha. Se pinta desde el móvil y se refresca por detrás |

> La plantilla de SDK 57 trae las rutas en `src/app/`. Aquí las rutas viven en
> `app/`: al montar el proyecto no se copia el `src/app` de ejemplo. `app.json`
> ya lleva los iconos (generados con `scripts/generar_iconos.py`), `expo-sqlite`
> y la pantalla de carga; los iconos solo se ven en el APK, no en Expo Go.

## Orden de trabajo sugerido

1. **Apuntar.** Es lo que da valor diario a la app y lo que hoy se hace en la hoja. Una hoja modal desde el botón flotante de *Hoy*, con dos caminos: lo de la casa (`menu_casa`) y lo de cada niño (`registro_nino`). El detalle está en `docs/04-app.md`. Regla que no se negocia: **dos toques** desde la pantalla de inicio.
2. **Caché local y cola.** `expo-sqlite`: pintar siempre desde la caché y sincronizar por detrás; toda escritura va primero a la cola local y sube con la acción `sync`. Hasta que esto exista, la app necesita cobertura para todo, y eso en la práctica significa que se abandona.
3. **Calendario.** Mes con la custodia de fondo y capas conmutables.
4. **Niños.** Rejilla semanal del registro, colegio y salud.
5. **Notificaciones** (fase 2): cambio de custodia mañana, entrega mañana, medicación.

## Dos cosas que conviene no romper

**El "no" es un dato.** Que Niña2 no haya hecho caca se apunta como `valor: 'no'`,
y es distinto de no haberlo mirado. En la pantalla se ven diferentes a propósito.

**La recogida y el equipamiento los calcula el backend,** no la app. Si hace
falta cambiar esa lógica, se cambia en `apps-script/agenda.gs` y se prueba con
`node scripts/probar_backend.js`, que la ejecuta contra los datos reales sin
tocar Google. Duplicar ese cálculo en la app es la forma segura de que un día
digan cosas distintas.
