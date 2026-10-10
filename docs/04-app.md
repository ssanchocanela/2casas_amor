# Pantallas y flujos

## Idea de partida

Cuatro pestañas abajo: **Hoy · Calendario · Niños · Ajustes**.

La regla que ordena todo el diseño: **apuntar algo del registro diario nunca
debe costar más de dos toques desde la pantalla de encendido**. Si cuesta
tres, se abandona a la semana. Todo lo demás puede estar a la distancia que
haga falta.

---

## 1. Hoy

Es la pantalla que se ve al abrir. Responde, sin desplazarse, a "¿qué pasa hoy?".

```
┌─────────────────────────────────┐
│  Martes 6 de octubre            │
│                                 │
│  ╭───────────╮ ╭───────────╮    │
│  │  NIÑO1    │ │  NIÑA2    │    │  ← una tarjeta por niño,
│  │  con papá │ │  con papá │    │    en su color
│  │  → mamá   │ │  → mamá   │    │  ← próximo cambio
│  │    el vie │ │    el vie │    │
│  ╰───────────╯ ╰───────────╯    │
│                                 │
│  HOY SE HA APUNTADO             │  ← los dos toques: siempre a la
│  Niño1  🍽 ✓  🚿 —  💩 —  💇 —  │    vista al abrir
│  Niña2  🍽 —  🚿 —  💩 ✓  💇 ✓  │
│                                 │
│  RECOGIDA HOY                   │
│  Niño1  18:00  Fútbol           │  ← no 17:00: hoy hay extraescolar
│  Niña2  18:15  Gimnasia         │
│         puerta principal        │
│                                 │
│  MAÑANA HAY QUE LLEVAR          │
│  Niño1  chándal + piscina       │  ← miércoles: Piscina (CH+PS)
│                                 │
│  COMEDOR                        │
│  🍽 Arròs · Truita · Fruita     │
│                                 │
│  VENCE MAÑANA                   │
│  ▸ Niño1 — Mural del cuerpo     │
│                                 │
│        ╭───────────────╮        │
│        │   + Apuntar   │        │  ← botón flotante
│        ╰───────────────╯        │
└─────────────────────────────────┘
```

Los iconos de "hoy se ha apuntado" son **botones**: tocar el plato de Niño1
abre directamente el apunte de cena de Niño1, ya rellenado con la fecha, la
hora y la casa. Ese es el camino de dos toques.

Por eso el bloque va justo debajo de las tarjetas y no al final: los días de
cole, con recogida, mochila, comedor y entregas, al final quedaría fuera de la
pantalla, y apuntar costaría un gesto más.

### El menú del comedor

El colegio da el menú de cada mes como una imagen, y así se enseña: en el bloque
**Comedor**, un enlace "Menú de septiembre ›" abre la imagen a todo el ancho, que
se amplía al tocarla. Las imágenes viven en una carpeta de Drive (una por mes,
`AAAA-MM.jpg`); el móvil guarda la del mes para verla sin red.

### Los dos bloques que más valen

**Recogida hoy** es la respuesta a la pregunta que de verdad se hace uno cada
tarde. No es un dato guardado en ninguna parte: la app lo calcula cruzando
`horario_centro` (la salida ordinaria y la puerta) con `extraescolares` (si hoy
hay actividad, manda su `hora_fin`) y con `calendario_escolar` (si es jornada
reducida). Es exactamente lo que hoy obliga a mirar el papel de la nevera, y por
eso va arriba, solo por debajo de lo apuntado.

**Mañana hay que llevar** sale del `equipamiento` de `horario_lectivo` y
`extraescolares`: `CH` chándal, `PS` piscina, `CH+PS` las dos cosas. Aparece por
la tarde, que es cuando sirve de algo, y desaparece si no hay nada que preparar.
Es la traducción directa de vuestra nomenclatura del papel.

---

## 2. Apuntar

Una hoja que sube desde abajo, no una pantalla nueva. Hay dos cosas distintas
que apuntar, y la app las separa igual que la hoja:

### Lo de la casa → `menu_casa`
Qué se ha cocinado hoy: comida, cena, fruta, y una nota. Un solo formulario al
día, no uno por niño. Si ya hay apunte de hoy, se abre para editarlo en vez de
crear otro.

### Lo de cada niño → `registro_nino`

1. **Niño** — Niño1 o Niña2, preseleccionado si solo hay uno en casa.
2. **Qué** — rejilla de iconos grandes: caca, ducha, lavado de pelo, cómo ha comido, medicación, ánimo, observación.
3. **Detalle** — según el tipo:
   - caca, ducha, lavado de pelo → **sí** o **no**, dos botones grandes. El "no" se guarda igual que el "sí": que Niña2 no haya hecho caca es un dato, no un hueco
   - cómo ha comido → escala de 1 a 5 con caritas
   - medicación → qué y cuánto, con sugerencia de la pauta activa de `salud_eventos`
   - ánimo → escala de 1 a 5
   - observación → texto libre
4. **Guardar.**

La casa y el autor se rellenan solos: la casa según la custodia de ese día, el
autor según quién ha iniciado sesión. Ambos se pueden corregir, pero casi nunca
hará falta.

Atajo que ahorra la mitad de los toques: en las acciones que casi siempre se
hacen a la vez para los dos (la ducha de después de cenar), el selector de niño
admite **los dos**, y la app escribe dos filas, una por niño. Sigue habiendo un
dato por niño, pero solo un gesto.

Si no hay red, se guarda igual y aparece un punto gris de "pendiente de subir"
que desaparece solo.

---

## 3. Calendario

Mes por defecto, semana de un deslizamiento (hacia arriba; hacia abajo se vuelve
al mes, y a los lados se cambia de mes o de semana), y un selector de capas arriba:

- **Custodia** — fondo de color del día entero. Es la capa que nunca se apaga.
- **Colegio** — festivos y días no lectivos en gris.
- **Tareas y entregas** — un punto en el día de entrega, del color del niño.
- **Eventos** — colonias, excursiones, reuniones.
- **Salud** — citas médicas.

Tocar un día enseña debajo su resumen: quién los tiene y lo de las capas
encendidas. Tocar el resumen abre el detalle, que es la pantalla "Hoy" de esa
fecha; en la vista de semana, tocar un día lo abre directamente. En ese detalle
se puede apuntar un día pasado (lo que se olvidó); en un día futuro, no.

Arriba a la derecha, un recuento discreto: *"Septiembre: papá 17 · mamá 13"*.
Sin dramatismo, pero visible.

---

## 4. Niños

Un selector de niño arriba y tres pestañas:

### Día a día
Vista de semana: una rejilla de siete columnas por tipo de apunte, para ver de
un vistazo los huecos. Es aquí donde se detecta que Niña2 lleva tres días sin
hacer caca o que Niño1 no cena desde el martes. Debajo de la rejilla del niño,
lo que se cocinó cada día en cada casa, que viene de `menu_casa`.

La distinción entre **"no"** y **casilla vacía** se mantiene visualmente: un "no"
apuntado se ve como tal, y un día sin apuntar se ve gris. No son lo mismo y la
app no debe hacer que lo parezcan.

### Colegio
- Horario de la semana, con las extraescolares encima de la salida del colegio y el equipamiento de cada día marcado.
- Tareas, agrupadas por *vence hoy · esta semana · más adelante · hechas*.
- Lecturas, con lo que está leyendo ahora arriba.
- Eventos próximos.

**Las tres se añaden y se corrigen desde aquí**, y lo mismo vale para Salud. Cada sección tiene su
*+ Añadir*, y tocar una línea abre la misma ficha para corregirla. La casilla
de una tarea la da por hecha de un toque, sin abrir nada. El formulario sale de
la declaración de `src/domain/fichas.ts`, que copia los campos de la hoja: para
añadir un campo se añade allí una línea, no una pantalla.

Lo que no se pregunta: el niño viene puesto (el de la ficha abierta), el tipo
trae el valor de siempre y la fecha de entrega viene puesta en mañana. Las
fechas no se escriben a mano —chips de *hoy · mañana · +1 semana* y flechas de
un día—, porque escribir `2026-10-16` en un móvil es pedir una errata.

El **borrado es la única excepción a la regla de no preguntar**: pide un
segundo toque. El backend borra en lógico rellenando `eliminado_en` y no admite
desborrar, así que un "deshacer" que a veces funcionara sería peor que no
tenerlo. Añadir y corregir sí lo ofrecen.

### Salud
- Línea de tiempo de `salud_eventos`, la más reciente arriba.
- Alergias y notas médicas siempre visibles en la cabecera, no enterradas.
- Tratamientos activos destacados, con los días que quedan.
- Peso y talla en lista (gráfica en la fase 2).

Consultas y medidas se añaden y se corrigen con la misma ficha que las de
Colegio: `+ Añadir` en *Historial* y en *Peso y talla*, y tocar una línea —o un
tratamiento activo— para corregirla. El peso admite coma y se guarda con punto,
que es como vive en la hoja.

Una pauta solo cuenta como **tratamiento activo** si el apunte es de tipo
*Medicación*; esa es la regla del backend (`agenda.gs`) y de la ficha del niño.
Si se escribe una pauta con otro tipo, el formulario lo avisa ahí mismo, en vez
de dejar que se apunte algo que luego no aparece en ningún sitio.

---

## 5. Ajustes

- Quién soy (y cambiar de persona).
- Conexión: URL del script y token, con un botón de probar conexión.
- Niños y personas.
- Curso escolar activo.
- **Volcar menú del comedor**: elegir mes, y rellenar día a día o pegar el texto del menú para que lo reparta. La foto del menú es fase 2.
- **Horario lectivo**: editor de rejilla, se rellena una vez por curso.
- Estado de sincronización y cola de pendientes.

---

## Decisiones de diseño que conviene respetar

**Color por progenitor, no por niño, en la custodia.** La pregunta que se hace
uno mirando el calendario es "¿quién los tiene?", no "¿de quién es este día?".
El color del niño se usa en todo lo demás.

**Nunca pedir confirmación al apuntar.** Guardar y mostrar un "deshacer" durante
unos segundos. Un diálogo de confirmación en cada cena es la forma más rápida de
que se abandone la app.

**Las observaciones son visibles para los dos, y eso hay que recordarlo al
escribir.** Un campo de observación en una app compartida entre progenitores
separados acaba usándose, tarde o temprano, para decir algo que no es sobre el
niño. Merece la pena que el texto de ayuda del campo diga algo tan simple como
*"lo que el otro necesita saber sobre el niño"*. No lo impide, pero lo enmarca.

**Nada de campos de texto libre donde pueda haber una lista.** Cada texto libre
es un dato que mañana no se puede buscar ni contar.

**La app se abre en "Hoy" siempre.** Nunca en la última pantalla que se vio.
