# Poner en marcha el backend

Unos diez minutos. Todo se hace desde la cuenta de Google neutral, la dueña de
la hoja.

---

## 0. Antes de nada: convertir la hoja a formato Google

**Esto es imprescindible y probablemente esté pendiente.** Si el enlace de tu
hoja lleva `rtpof=true` o el identificador tiene 33 caracteres en vez de 44, lo
que hay en Drive sigue siendo el fichero `.xlsx` subido, no una Hoja de cálculo
de Google. Se puede ver y editar, pero **no admite Apps Script**, que es
justamente lo que vamos a instalar.

Para convertirla: abre el fichero en Drive y usa **Archivo → Guardar como Hojas
de cálculo de Google**. Se crea un documento nuevo, con un identificador nuevo.
Ese es el bueno. Al `.xlsx` original añádele `ARCHIVO —` delante del nombre para
no confundirte, o bórralo.

Comprueba después que la conversión ha mantenido las validaciones: pincha una
celda de la columna `tipo` en `registro_nino` y mira que salga el desplegable.

**Pon la zona horaria de la hoja en Madrid:** *Archivo → Configuración → Zona
horaria → (GMT+01:00) Madrid*. Una hoja creada desde una cuenta nueva suele venir
con otra zona, y entonces lo que alguien escriba a mano como `21:42` se lee con
horas de diferencia. El script escribe siempre como texto y no le afecta, pero
las ediciones a mano sí. Hazlo también en la copia de pruebas.

---

## 1. Abrir el editor de Apps Script

En la hoja ya convertida: **Extensiones → Apps Script**. Se abre un editor con
un fichero `Código.gs` vacío.

## 2. Copiar el código

Abre **`TODO-EN-UNO.gs`**, cópialo entero y pégalo dentro de `Codigo.gs`,
sustituyendo lo que hubiera. Un solo pegado.

Es el mismo código que los ficheros sueltos (`tablas.gs`, `acciones.gs`,
`agenda.gs`, `custodia.gs`, `instalar.gs`, `Codigo.gs`), concatenados. Los
sueltos son los que se editan y se versionan; `TODO-EN-UNO.gs` se regenera con
`python scripts/juntar_backend.py` y existe solo para instalar a mano. Cuando el
proyecto se suba con `clasp push`, se vuelve a los ficheros separados.

Para el manifiesto: **⚙ Configuración del proyecto → Mostrar el archivo de
manifiesto `appsscript.json`**, y sustituye su contenido por el de
`appsscript.json`.

## 3. Comprobar que la hoja está bien

En el desplegable de funciones elige **`comprobarHoja`** y pulsa *Ejecutar*.

La primera vez Google pide permisos y muestra un aviso de que la aplicación no
está verificada: **Configuración avanzada → Ir a (nombre del proyecto)**. Es tu
propio script sobre tu propia hoja; el aviso aparece porque no está publicada en
el mercado de Google, no porque haya nada raro.

Mira el registro de ejecución. Debe decir *"Todo correcto"*. Si lista problemas,
son cosas por rellenar en la hoja; arréglalas y vuelve a ejecutar.

## 4. Generar los tokens

Ejecuta **`generarTokens`**. En el registro aparecen un token por persona.

**Cópialos ahora**, porque no se vuelven a mostrar. Guárdalos donde guardes tus
contraseñas, nunca en un fichero del proyecto.

Si algún día quieres revocar el acceso de alguien, se vuelve a ejecutar esta
función: genera tokens nuevos e invalida todos los anteriores.

## 5. Probar la agenda

Ejecuta **`probarAgenda`**. Debe devolver un JSON con los dos niños, sus clases
de hoy, la hora de recogida y lo que hay que llevar mañana.

Es la prueba de fuego: si la recogida sale bien aquí, la app solo tiene que
pintarlo.

## 6. Publicar

> **"Aplicación web" no significa que vayamos a hacer una web.** Es el nombre
> que Google le da a la única forma de publicar un Apps Script que responda a
> peticiones desde fuera: le da una dirección. Nadie va a abrir esa dirección en
> un navegador; quien la llama es el APK, igual que cualquier app llama a un
> servidor. No hay página, ni pantallas, ni nada que mirar: solo una dirección
> que devuelve datos.

**Implementar → Nueva implementación → ⚙ → Aplicación web**, y:

| Campo | Valor |
|---|---|
| Descripción | `API 2casas v1` |
| Ejecutar como | **Yo** (la cuenta neutral) |
| Quién tiene acceso | **Cualquier usuario** |

Sí, "cualquier usuario" suena mal, pero es lo correcto aquí: significa que la
dirección responde sin pedir cuenta de Google, y quien controla el acceso es el
token del paso 4. Sin esto, la app tendría que iniciar sesión en Google en cada
llamada, que es exactamente la complicación que queríamos evitar.

Copia la **URL de la aplicación web** que aparece al terminar. Esa dirección y
el token son lo único que hay que meter en el APK: son sus credenciales de
acceso a la hoja, nada más.

## 7. Comprobar desde fuera

Abre la URL en el navegador. Debe responder algo así:

```json
{"ok":true,"servicio":"2casas","version_api":1,"version_esquema":"1"}
```

Si responde eso, está funcionando.

---

## La copia de pruebas

Las pruebas que **escriben** (apuntar, editar, borrar) se hacen contra una copia
de la hoja, nunca contra la de verdad. No es por miedo a romper nada: es para
que el histórico real no se llene de cincuenta cenas inventadas.

Las **lecturas** contra la hoja de verdad son seguras. `bootstrap`, `agenda`,
`list` y `custodia` no escriben nada, así que para ver la pantalla Hoy con datos
reales vale la implementación buena.

Para montar la copia, desde la cuenta neutral:

1. **Archivo → Hacer una copia** de la hoja buena. Nómbrala con `PRUEBAS —`
   delante. La copia se lleva el Apps Script, pero como un proyecto de script
   distinto, **sin implementación**: la URL buena sigue apuntando a la hoja
   buena.
2. En la pestaña `config` de la copia, pon `entorno` = `pruebas`. La app lo
   muestra en Ajustes, y es lo que se comprueba antes de lanzar pruebas de
   escritura.
3. En la copia, deja **vacío** `calendar_id_colegio`. Si no, `evento_calendar`
   escribiría en el calendario real, porque cuando falta ese valor usa
   `calendar_id_custodia`. La custodia se puede seguir leyendo del calendario
   de verdad: leer es seguro.
4. Abre **Extensiones → Apps Script** desde la copia (fíjate en que el nombre de
   la hoja arriba lleve `PRUEBAS —`) y repite los pasos 4 a 7 de arriba:
   `generarTokens` y una implementación nueva, con su **propia URL**.
   `generarTokens` sobrescribe los tokens del proyecto donde se ejecuta: así la
   copia tiene los suyos, y los buenos no sirven contra ella. **Ejecutarla por
   error en el script de la hoja buena invalida los tokens de verdad.**
5. Guarda esa URL y esos tokens aparte de los buenos, y márcalos como de
   pruebas. Nunca en un fichero del proyecto.

Si al cambiar el backend vuelves a implementar, recuerda hacerlo en las dos:
son dos proyectos de script independientes.

---

## Al cambiar el código

Cada vez que modifiques el script hay que **volver a implementar** para que la
URL sirva la versión nueva: *Implementar → Gestionar implementaciones → ✏️ →
Versión: Nueva → Implementar*. La URL no cambia.

Es el error más habitual: tocar el código, no reimplementar, y no entender por
qué la app sigue viendo lo de antes.

**Cómo comprobarlo:** abre en el navegador la URL que usa la app. Debe decir el
mismo `version_backend` que hay en `Codigo.gs`. Si dice otro, o no lo dice, esa
URL sirve una versión anterior. El despiste típico es usar *Nueva implementación*
en vez de editar la que ya existe: crea otra URL y la de la app se queda como
estaba. Al cambiar el código, sube también `VERSION_BACKEND` en `Codigo.gs`.

## El menú del comedor en imagen

El colegio da el menú de cada mes como imagen. Se guarda en una carpeta de Drive
de la **cuenta neutral**, sin compartir por enlace:

1. Sube cada mes una imagen llamada con el mes: `2026-09.jpg`, `2026-10.png`…
   Si subes otra con el mismo nombre, la app descarga la nueva sola.
2. En la pestaña `config` de las dos hojas, la clave `carpeta_menus` lleva el id
   de la carpeta: lo que va detrás de `/folders/` en su dirección.
3. La primera vez, el script necesita permiso para leer Drive: tras pegar el
   código nuevo, ejecuta **`comprobarHoja`** en el editor, acepta el permiso que
   pide Google y mira que en el registro salgan las imágenes. Después, vuelve a
   implementar.

## La API en una línea

Todo son peticiones `POST` a esa URL, con cuerpo JSON:

```json
{ "token": "…", "accion": "agenda", "datos": { "fecha": "2026-10-06" } }
```

Las acciones están en `Codigo.gs`. El token va en el cuerpo, no en una cabecera,
porque una aplicación web de Apps Script no puede leer cabeceras propias.
