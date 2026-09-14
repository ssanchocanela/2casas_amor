# 2 Casas + Amor — instrucciones de trabajo

App familiar para coordinar el día a día de dos niños entre dos casas.
Antes de tocar nada, leer `docs/01-plan.md`, `docs/02-hoja-de-calculo.md`,
`docs/03-arquitectura.md` y `docs/04-app.md`.

## Contexto en una frase

Los datos viven en **Google Sheets** (registro diario, salud, colegio, menús) y
en **Google Calendar** (custodia). El backend es un **Apps Script** publicado
como aplicación web. La app es **React Native con Expo, solo Android**. No hay servidor propio
ni base de datos propia, y eso es una decisión deliberada, no una carencia.

## Idioma

- Todo lo que ve el usuario, en **español**: textos, mensajes de error, fechas, formatos.
- El código en inglés, salvo los nombres de campo del dominio, que replican
  exactamente las cabeceras de la hoja (`nino_id`, `casa_persona_id`,
  `eliminado_en`…). Esa correspondencia literal es intencionada: es lo que hace
  que el esquema sea rastreable de la hoja al código.
- Documentación y comentarios, en español.

## Reglas que no se rompen

1. **El esquema de la hoja es un contrato.** No añadir, renombrar ni reordenar columnas sin actualizar `docs/02-hoja-de-calculo.md` y subir `version_esquema` en la pestaña `config`.
2. **Las columnas se localizan por nombre de cabecera, nunca por índice.** Alguien editará la hoja a mano; el código no puede depender de que la columna F siga siendo la F.
3. **Nada se borra.** Borrado lógico rellenando `eliminado_en`. No hay `deleteRow` en ningún sitio.
4. **Toda escritura pasa por `LockService` y deja rastro en la pestaña `log`.** Sin excepciones.
5. **Ningún secreto en el repositorio.** Ni la URL del script, ni los tokens, ni los id de calendario. Van en `.env` (fuera de git) y, en el móvil, en `expo-secure-store`. El token viaja en el cuerpo del POST, nunca en la URL ni en una cabecera: Apps Script no puede leer cabeceras propias.
6. **La app funciona sin red.** Toda escritura se encola en local y se pinta al instante. Si una función nueva exige conexión para dar respuesta, está mal planteada.
7. **Fechas en `AAAA-MM-DD` y horas en `HH:MM`, siempre como texto.** Zona horaria `Europe/Madrid`. Nunca confiar en el formato regional de quien abra la hoja.
8. **Apuntar cuesta dos toques.** Cualquier cambio que añada un paso al registro diario necesita una razón muy buena.

## Estructura

```
docs/             el diseño
apps-script/      el backend (ver LEEME-instalacion.md); se sube con clasp
scripts/          utilidades: genera la plantilla de la hoja y prueba el backend
movil/            la app Expo (ver movil/LEEME-arranque.md)
  app/            pantallas, Expo Router
  src/domain/     tipos, espejo del esquema de la hoja
  src/api/        cliente de la API de Apps Script
  src/estado/     sesión: credenciales en el Keystore
  src/db/         base SQLite del móvil: cola de escrituras y caché de lectura
  src/ui/         tema y piezas compartidas
```

La app vive en `movil/` y no trae `package.json`: el andamiaje de Expo se crea
en el momento con `create-expo-app`, para no arrastrar versiones caducadas.
Instrucciones en `movil/LEEME-arranque.md`.

## Comandos

```bash
cd movil && npx expo start           # desarrollo, se abre con Expo Go
cd movil && npx expo prebuild --platform android --clean && cd android && ./gradlew assembleRelease
                                     # el APK firmado (ver movil/LEEME-arranque.md, paso 5)
cd movil && npx tsc --noEmit         # comprobar tipos

python scripts/generar_hoja.py       # regenerar la plantilla de la hoja
python scripts/generar_iconos.py     # regenerar los iconos de la app (necesita Pillow)
python scripts/juntar_backend.py     # regenerar apps-script/TODO-EN-UNO.gs
python scripts/volcar_hoja.py && node scripts/probar_backend.js
                                     # probar el backend contra los datos reales
```

`probar_backend.js` ejecuta el Apps Script fuera de Google simulando su entorno.
Es la forma de tocar `agenda.gs` sin publicar nada: úsalo siempre antes de subir
un cambio del backend.

## Cómo abordar el trabajo

- **Una funcionalidad, una rama.** Nada de ramas que tocan tres áreas a la vez.
- **El dominio primero.** Antes de una pantalla nueva: el tipo en `src/domain/`, luego la API, luego la caché, y al final la interfaz.
- **Probar contra una copia de la hoja**, nunca contra la de verdad. `config.entorno` = `pruebas` en esa copia.
  La regla aplica a las **escrituras**; las lecturas (`bootstrap`, `agenda`, `list`, `custodia`) contra la hoja buena son seguras. Cómo montar la copia: `apps-script/LEEME-instalacion.md`, "La copia de pruebas".
- **Al cambiar el esquema**, actualizar en el mismo commit: la documentación, los tipos de `src/domain/`, el Apps Script y la migración si hace falta.
- **Commits en español**, describiendo el efecto y no el fichero tocado.

## Lo que este proyecto no es

No es un producto para vender a otras familias. Cada decisión se toma para que
dos personas concretas lo usen a diario durante años con el mínimo
mantenimiento. Ante la duda entre lo elegante y lo que se puede arreglar un
martes por la noche en diez minutos, gana lo segundo.

Tampoco es un canal de comunicación entre los progenitores. No hay chat, no hay
comentarios, no hay hilos. Lo que se apunta es sobre los niños.

## Estado

**Fase 0 terminada** (13 de septiembre de 2026). La hoja está convertida a Hoja
de cálculo de Google con el esquema v1, el Apps Script está publicado como
aplicación web y responde, y los tokens están generados.

La URL de la implementación y los tokens **no están en el repositorio y no deben
estarlo**: viven en el `.env` local y, en el móvil, en `expo-secure-store`.

**Fase 1 en marcha** (13 de septiembre de 2026):

- La app arranca con Expo SDK 57, solo Android. **Hoy** pinta custodia, lo
  apuntado (justo debajo de las tarjetas, para que sus iconos se vean siempre al
  abrir), recogida, equipamiento y comedor; sin red, con la última agenda.
- **Apuntar está hecho.** Dos toques desde los iconos de "hoy se ha apuntado",
  tres desde "+ Apuntar". Lo de la casa va a `menu_casa` (una fila por día y
  casa; si existe, se edita) y lo de cada niño a `registro_nino` (el "no" se
  guarda). "Los dos" en ducha y pelo. Casa y autor salen solos y se corrigen
  tocándolos. Guardar no pregunta: ofrece deshacer.
- **Calendario hecho.** Mes con la custodia de fondo (color de `personas`) y el
  recuento del mes; capas colegio, tareas, eventos y salud, que se recuerdan;
  semana deslizando hacia arriba. Tocar un día abre la misma pantalla que Hoy
  (`src/ui/dia/PantallaDia.tsx`, ruta `app/dia/[fecha].tsx`), donde también se
  apunta un día pasado; en uno futuro, no.
- **Niños hecho.** Ficha por niño con alergias y notas médicas siempre arriba.
  Día a día: rejilla semanal (sí, no, sin apuntar y futuro se ven distintos;
  tocar una casilla abre el día), aviso de caca y lo cocinado en casa. Colegio:
  horario de `horario_lectivo` como tabla con extraescolares, tareas agrupadas,
  lecturas y eventos. Salud: tratamientos activos, historial, peso y talla.
- **Menú del comedor en imagen.** Una imagen por mes (`AAAA-MM.jpg`) en la
  carpeta de Drive de `config.carpeta_menus`. El script la entrega con el token
  (acciones `menus_comedor` y `menu_imagen`; la app no usa cuenta de Google), el
  móvil la guarda y la enseña desde Hoy → Comedor, también sin red.
- **Horario de clases completo** de los dos, fijo para el curso. Fuente:
  `scripts/datos/horario_lectivo_2026-2027.json`, que alimenta la plantilla y
  `scripts/cargar_horario.js` (lo vuelca en una hoja por el backend, sin duplicar;
  `--pruebas` para la copia). Se ve en Niños → Colegio y en "Clases de hoy"; un
  día festivo, no lectivo o de vacaciones no muestra ninguna clase.
- Toda escritura entra en una **cola local en SQLite** (`src/db/cola.ts`) y sube
  con `sync`; lo que el backend rechaza se ve en Ajustes con su motivo.
- **Caché de lectura propia, sin TanStack Query** (`src/db/cache.ts`,
  `src/estado/lectura.ts`): las pantallas pintan lo guardado y refrescan por
  detrás con `useLectura` (respuestas enteras, como la agenda de cada día) y
  `useFilas` (filas de una pestaña por rango de fechas, lo que usarán Niños y
  Calendario).
- Backend `version_backend` **2026-09-14.1** (comprobado en la copia; en la hoja
  buena, confirmado por el usuario): no duplica reenvíos, escribe siempre como
  texto plano, ignora las ediciones de lo borrado y la agenda tarda de 7 a 12
  segundos. Cada hoja tiene varias implementaciones: la que cuenta es la del id
  que aparece en la URL de la app (Ajustes → Conexión). **Tras cada cambio del
  backend: subir `VERSION_BACKEND`, reimplementar en las dos hojas y abrir la URL
  en el navegador para ver que sirve la versión nueva.**
- Para desarrollar, las credenciales de la copia de pruebas están en
  `movil/.env.local` (fuera de git; nunca con prefijo `EXPO_PUBLIC_`, que las
  metería en el APK). Las de la hoja buena se meten a mano en el móvil.
- Iconos de la app: `scripts/generar_iconos.py`. Maquetas de Calendario y Niños:
  unas maquetas que no están en la versión pública.

**Fase 2 de `PROMPT-claude-code.md` hecha** (14 de septiembre de 2026): caché de
lectura y cola, con la prueba de aceptación en modo avión superada.

- **APK 1.0.0 generado** (14 de septiembre de 2026), firmado con la clave propia
  de la familia: `~/.doscasas/doscasas-release.keystore`, con sus contraseñas en
  `~/.gradle/gradle.properties`. Fuera del repositorio y **sin copia no se puede
  actualizar la app instalada**. No lleva credenciales dentro: cada móvil pide la
  URL de la hoja buena y su token al abrirse la primera vez. Para la siguiente
  versión, subir `android.versionCode` en `app.json`.

Lo siguiente: instalar el APK en los dos móviles y, al terminar, el repositorio
público anonimizado.
