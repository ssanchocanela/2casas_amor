# Prompt para Claude Code

Pegar tal cual al abrir Claude Code en la carpeta del proyecto.
Al terminar cada fase, actualizar el apartado "Estado" de `CLAUDE.md` y volver
aquí a por el siguiente bloque.

---

## Fase 1 · Arrancar la app y construir "Apuntar"

```
Este es el proyecto "2 Casas + Amor": una app familiar para coordinar el día a
día de dos niños, Niño1 y Niña2, entre dos casas. Los datos viven en Google
Sheets y Google Calendar; el backend es un Apps Script ya publicado y
funcionando; la app es React Native con Expo, solo Android.

Antes de escribir nada, lee en este orden:
  CLAUDE.md                   las reglas del proyecto, no negociables
  docs/01-plan.md             qué es y por qué
  docs/02-hoja-de-calculo.md  el esquema de la hoja: es el contrato
  docs/03-arquitectura.md     cómo hablan la app, el backend y Google
  docs/04-app.md              pantallas y flujos
  movil/LEEME-arranque.md     cómo montar el proyecto Expo y qué falta

Estado actual: la fase 0 está terminada. La hoja está montada con el esquema v1,
el Apps Script está publicado y responde, y en movil/ está escrito el código
propio de la app (tipos, cliente de API, sesión, pantalla de conexión, pantalla
"Hoy" y marcadores de Calendario y Niños). No hay package.json todavía: es
deliberado.

Tu trabajo tiene dos partes.

PARTE 1 — Dejar la app corriendo.
Sigue los pasos 1 a 4 de movil/LEEME-arranque.md: crea el andamiaje de Expo con
create-expo-app, fusiónalo con lo que ya hay en movil/app y movil/src sin
pisarlo, instala expo-secure-store y expo-status-bar con `expo install`, escribe
app.json y comprueba que `npx tsc --noEmit` pasa limpio.

Para probarla necesitas la URL del backend y un token: pídemelos por el chat
cuando llegues ahí. No los escribas en ningún fichero del repositorio.

Termina esta parte cuando la pantalla "Hoy" muestre a Niño1 y Niña2 con su hora
de recogida real. Enséñame una captura o dime qué ves antes de seguir.

PARTE 2 — Construir "Apuntar".
Es la pantalla que da valor diario a la app; hasta que exista, seguimos
apuntando a mano en la hoja. El diseño está en docs/04-app.md, apartado 2.

Son dos caminos distintos, y esa separación es el corazón del modelo de datos:
  · Lo de la casa  -> tabla menu_casa:     comida, cena, fruta, notas.
    Una fila por día y casa, no una por niño: la cena se cocina una vez para los
    dos. Si ya existe el apunte de hoy, se edita en vez de crear otro.
  · Lo de cada niño -> tabla registro_nino: caca, ducha, lavado de pelo, cómo ha
    comido, medicación, ánimo, observación. Una fila por hecho.

Reglas concretas de esta pantalla:
  · Dos toques desde "Hoy" hasta guardar. Es el requisito que decide si la app
    se usa o se abandona. Si una decisión de diseño añade un toque, no la tomes.
  · En caca, ducha y lavado de pelo, guardar el "no" igual que el "sí"
    (valor: 'si' | 'no'). Que Niña2 no haya hecho caca es un dato, no un hueco.
    Ausencia de fila significa "no se miró", y es una tercera cosa distinta.
  · Los iconos del bloque "HOY SE HA APUNTADO" de la pantalla Hoy son botones:
    al tocarlos se abre el apunte correspondiente ya relleno.
  · casa_persona_id y autor_id se rellenan solos, desde la custodia del día y
    desde quién tiene el token. Corregibles, pero nunca preguntados.
  · Nada de diálogos de confirmación al guardar: guardar y ofrecer "deshacer"
    unos segundos.
  · El selector de niño admite "los dos" en las acciones que suelen hacerse a la
    vez (la ducha). Escribe dos filas, una por niño, con un solo gesto.

Al terminar, actualiza el apartado "Estado" de CLAUDE.md.

Trabaja en una rama. Commits en español, describiendo el efecto y no el fichero.
Si algo de la documentación se contradice con lo que encuentras, párate y
pregúntame en vez de decidir por tu cuenta.
```

---

## Fase 2 · Caché local y cola sin conexión

```
Lee CLAUDE.md y docs/03-arquitectura.md, apartado "La app".

Monta la caché local y la cola de escritura con expo-sqlite:
  · La app pinta SIEMPRE desde la caché local y sincroniza por detrás. Ninguna
    pantalla espera a la red para mostrar algo.
  · Toda escritura entra primero en una cola local con estado "pendiente" y se
    refleja en la interfaz al instante, con una marca gris de "sin subir".
  · Cuando hay red, la cola se vacía con la acción `sync` del backend, que
    devuelve un resultado por operación: un apunte que falle no debe bloquear a
    los demás.
  · Conflictos: gana la última escritura, salvo que el registro tenga
    eliminado_en; el borrado siempre gana.

Prueba de aceptación: en modo avión, apuntar una cena y una ducha, cerrar la
app, abrirla, ver los dos apuntes con su marca de pendiente, recuperar la red y
comprobar que suben solos y que aparecen en la hoja de Google.

Actualiza el "Estado" de CLAUDE.md al terminar.
```

---

## Fase 3 · Calendario

```
Lee docs/04-app.md, apartado 3.

Vista de mes con la custodia como fondo de cada día (color del progenitor, que
sale de la pestaña 'personas'), semana a un deslizamiento, y capas conmutables:
colegio, tareas y entregas, eventos, salud. La capa de custodia no se apaga.

La custodia se pide al backend con la acción `custodia` sobre un rango; no la
calcules en la app. Tocar un día abre el detalle de esa fecha, que es la misma
pantalla "Hoy" con otra fecha: reutiliza el componente, no lo dupliques.

Arriba a la derecha, el recuento de días del mes por progenitor.
```

---

## Fase 4 · Niños

```
Lee docs/04-app.md, apartado 4.

Ficha por niño con tres pestañas: día a día, colegio y salud.

Lo más importante es la rejilla semanal del registro: siete columnas, una fila
por tipo de apunte, para ver los huecos de un vistazo. Un "no" apuntado y una
casilla sin apuntar tienen que verse distintos.

En salud, las alergias y las notas médicas van siempre visibles en la cabecera,
no enterradas en una pestaña. Es información que alguien puede necesitar leer en
diez segundos.
```

---

## Cómo tocar el backend

Si hace falta cambiar el Apps Script (por ejemplo, la lógica de recogida):

```
Edita los ficheros sueltos de apps-script/, nunca TODO-EN-UNO.gs.
Prueba con:  python scripts/volcar_hoja.py && node scripts/probar_backend.js
Ese script ejecuta el Apps Script fuera de Google, contra los datos reales de la
hoja, sin publicar nada. Añade una comprobación nueva por cada cambio.
Cuando pase, regenera el fichero único con: python scripts/juntar_backend.py
Y recuérdame que hay que volver a implementar en Google: si no, la app sigue
viendo la versión anterior.
```
