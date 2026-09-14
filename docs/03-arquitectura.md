# Arquitectura técnica

```
   ┌──────────────────────┐        ┌──────────────────────┐
   │  App (papá)          │        │  App (mamá)          │
   │  React Native · Expo │        │  React Native · Expo │
   │  caché local SQLite  │        │  caché local SQLite  │
   └──────────┬───────────┘        └───────────┬──────────┘
              │        HTTPS + token por persona │
              └──────────────┬───────────────────┘
                             ▼
              ┌──────────────────────────────┐
              │  Google Apps Script Web App  │
              │  API JSON · LockService      │
              │  corre como la cuenta neutral│
              └───────┬──────────────┬───────┘
                      ▼              ▼
            ┌──────────────┐   ┌──────────────────┐
            │ Google Sheets│   │ Google Calendar  │
            │ (los datos)  │   │ (la custodia)    │
            └──────────────┘   └──────────────────┘
```

## Por qué Apps Script y no OAuth desde la app

La alternativa obvia sería que la app hablara directamente con las APIs de
Google usando la cuenta de cada uno. Funciona, pero arrastra una cola larga:
hay que crear un proyecto en Google Cloud, configurar una pantalla de
consentimiento, gestionar tokens de refresco en el móvil, convivir con el aviso
de *"Google no ha verificado esta aplicación"* cada vez que caduca algo, y
repetirlo por plataforma.

Apps Script corta todo eso. El script vive dentro de la propia hoja, se publica
como aplicación web con una URL, y **se ejecuta con la identidad de la cuenta
propietaria**. La app móvil solo hace peticiones HTTP a esa URL. No hay OAuth,
no hay consentimiento, no hay verificación, no hay servidor que mantener y no
cuesta nada.

El precio es que la seguridad recae en un secreto compartido en vez de en
OAuth. Para una app familiar de dos usuarios es un intercambio muy razonable;
más abajo está cómo se acota.

**Límites de Apps Script** (holgadísimos para este uso): 20.000 llamadas al día,
6 minutos por ejecución, 90 minutos de ejecución al día. La latencia es de
medio segundo a dos segundos por llamada, que es exactamente por lo que la app
lleva caché local y no espera a la red para pintar nada.

## La app

- **React Native con Expo, solo Android.** Se descarta iOS: ahorra los 99 €/año de cuenta de desarrollador de Apple y todo el trabajo de firmas y publicación. Si algún día hace falta un iPhone, Expo genera versión web instalable con el mismo código, y eso basta.
- **Estado y sincronización:** caché propia en SQLite (`expo-sqlite`), sin TanStack Query: una dependencia menos que mantener durante años. La app pinta siempre desde la caché (`src/db/cache.ts`) y refresca por detrás con `useLectura` y `useFilas` (`src/estado/lectura.ts`): al abrir, al volver a la app y, mientras falle, cada 30 segundos.
- **Escritura offline:** todo apunte se guarda primero en local con estado `pendiente` y entra en una cola. Cuando hay red, la cola se vacía contra la API. Apuntar una cena en un sótano sin cobertura tiene que funcionar, porque si no funciona una vez, se deja de usar.
- **Resolución de conflictos:** gana la última escritura que llega al backend, salvo que el registro tenga `eliminado_en`: el borrado siempre gana, y el backend ignora cualquier edición de un registro borrado. Como cada apunte es una fila independiente y nadie edita el mismo apunte a la vez, los conflictos reales serán rarísimos.
- **Navegación:** Expo Router.
- **Notificaciones:** `expo-notifications`, programadas en local a partir de los datos ya sincronizados. No hace falta servidor de push. Fase 2.

## La API

Todo son peticiones `POST` a una única URL, con cuerpo JSON:

```json
{ "token": "…", "accion": "agenda", "datos": { "fecha": "2026-10-06" } }
```

`GET` sin parámetros devuelve una señal de vida, sin token y sin datos, para
comprobar de un vistazo que la aplicación está publicada.

### Lectura
| Acción | Qué devuelve |
|---|---|
| `bootstrap` | `config`, `personas`, `ninos`, `listas`, `custodia_mapeo`, horarios y extraescolares. Todo lo que la app necesita para arrancar |
| `list` | Filas de una pestaña, filtrando por `desde`, `hasta`, `nino` |
| `agenda` | Vista compuesta de un día: custodia, clases, **recogida**, **equipamiento de mañana**, menú, tareas que vencen, eventos, tratamientos activos y lo apuntado. Una sola llamada para pintar la pantalla de inicio |
| `custodia` | Lee Google Calendar en un rango y lo traduce a persona usando `custodia_mapeo` |
| `menus_comedor` | Los meses con imagen del menú del comedor en la carpeta de Drive de `config.carpeta_menus` |
| `menu_imagen` | La imagen de un mes, en base64. Si el móvil ya tiene esa versión, no la vuelve a mandar |

### Escritura
| Acción | Qué hace |
|---|---|
| `create` | Añade una fila. Genera el `id`, sella `creado_en` y `autor_id`, y escribe en `log` |
| `update` | Modifica una fila por `id`. Escribe en `log` el valor anterior y el nuevo |
| `delete` | Borrado **lógico**: rellena `eliminado_en` |
| `sync` | Vacía la cola de apuntes pendientes del móvil. Cada operación devuelve su propio resultado, para que un apunte con un problema no bloquee a los demás |
| `evento_calendar` | Crea o actualiza un evento en Google Calendar y guarda su id en `eventos.calendar_event_id` |

### Lo que se calcula, no se guarda

`agenda` no se limita a devolver filas. Dos de sus respuestas son deducciones, y
son las que justifican tener un backend en vez de leer la hoja a pelo:

- **La recogida** cruza `horario_centro` con `extraescolares` y `calendario_escolar`. Manda la extraescolar sobre la salida ordinaria, salvo la de mediodía —la robótica de los viernes—, que no cambia la hora de la tarde.
- **El equipamiento** une el `equipamiento` de las clases y el de las extraescolares de ese día, y dice además *por qué*: chándal *porque hay Psicomotricidad*.

### Reglas del lado del script
- Toda escritura se envuelve en `LockService.getScriptLock()` con espera de 10 segundos. Es lo que evita que dos móviles escriban en la misma fila a la vez.
- Toda escritura pasa por `log`. Sin excepciones.
- El script **nunca** borra filas ni reordena columnas.
- Las columnas se localizan **por nombre de cabecera**, nunca por índice. Así, si alguien inserta una columna a mano, nada se rompe.
- Si `config.version_esquema` no coincide con la que espera la app, la API responde con un aviso y la app muestra un mensaje en vez de escribir datos mal.

## Seguridad

| Capa | Medida |
|---|---|
| Propiedad | Una cuenta de Google neutral (ej. `casa.apellido@gmail.com`) es dueña de la hoja, el calendario y el script. Cada progenitor entra con su cuenta personal, a la que se da acceso de edición |
| Acceso a la API | Token largo y aleatorio **por persona**, guardado en `Script Properties`. Se revoca uno sin tocar el otro, reejecutando `generarTokens` |
| Dónde viaja el token | En el **cuerpo** de un POST, nunca en la URL ni en una cabecera. Una aplicación web de Apps Script no puede leer cabeceras propias, y la URL quedaría escrita en registros e historiales |
| En el móvil | El token se guarda en `expo-secure-store` (Keystore de Android), nunca en el código ni en el repositorio |
| En el repositorio | Ni tokens, ni id de calendario, ni URL del script. Todo en variables de entorno y `.env` fuera de git |
| Cuentas | Verificación en dos pasos obligatoria en las tres cuentas. Es la medida que más protege, con diferencia |
| Compartición | La hoja y el calendario se comparten **solo con personas concretas**. Nunca "cualquiera con el enlace": ahí dentro hay datos de salud de menores |
| Auditoría | La pestaña `log` registra quién escribió qué y cuándo |

## Repositorio

```
2casas/
├─ CLAUDE.md              ← instrucciones para Claude Code
├─ docs/                  ← este material
├─ app/                   ← React Native · Expo Router
│  ├─ (tabs)/             ← Hoy · Calendario · Niños · Ajustes
│  └─ …
├─ src/
│  ├─ api/                ← cliente de la API de Apps Script
│  ├─ db/                 ← caché SQLite y cola de sincronización
│  ├─ domain/             ← tipos y reglas, espejo del esquema de la hoja
│  ├─ components/
│  └─ hooks/
├─ apps-script/           ← el backend, versionado aquí y subido con clasp
│  ├─ Codigo.gs
│  ├─ api.gs
│  ├─ sheets.gs
│  ├─ calendar.gs
│  └─ appsscript.json
└─ scripts/
   └─ generar_hoja.py       ← genera la plantilla de la hoja desde el esquema
```

`scripts/generar_hoja.py` es la fuente de la plantilla. Si el esquema cambia, se
cambia ahí y se regenera el `.xlsx`, nunca se edita el fichero a mano: así el
documento, el script y la hoja no acaban diciendo cosas distintas.

El backend se versiona en el repositorio y se sube con **clasp**, la
herramienta de línea de comandos de Apps Script. Sin eso, el backend viviría
solo dentro de la hoja, sin historial y sin posibilidad de que Claude Code lo
mantenga.

## Migrar a base de datos el día de mañana

El esquema ya está pensado para eso: cada pestaña es una tabla, cada fila un
registro, cada campo un tipo. El día que la hoja se quede corta, la migración
es crear las tablas en Postgres con las mismas columnas, volcar las filas y
cambiar la implementación de `src/api/`. El resto de la app no se entera.

Esa es la razón de todas las reglas tediosas de `02-hoja-de-calculo.md`.
