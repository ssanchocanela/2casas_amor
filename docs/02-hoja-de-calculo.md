# Esquema de la hoja de cálculo

> Actualizado el 13 de septiembre de 2026 con los datos reales de Niño1 y Niña2.
> La plantilla generada a partir de este documento es `2casas-hoja-control.xlsx`.

La hoja **es la base de datos**. Por eso deja de parecer una hoja de cálculo y
pasa a parecer una tabla aburrida. Esa fealdad es intencionada: es lo que hace
que la app pueda leerla sin romperse, y lo que permitirá migrar a una base de
datos real el día que haga falta, casi sin trabajo.

## Reglas que no se rompen nunca

1. **Una pestaña = una tabla.** Cabeceras en la primera fila (la segunda si hay una nota gris arriba), en minúsculas y sin acentos. Debajo, un registro por fila.
2. **Nada de celdas combinadas, filas de título, ni columnas en blanco de separación.** El color y el formato condicional sí valen: no cambian los datos.
3. **Nada se borra.** Para dar de baja un registro se rellena `eliminado_en`. La app lo oculta. El historial se queda.
4. **Nunca se reordenan ni se renombran columnas.** Si hay que añadir una, va al final y se sube `version_esquema` en `config`.
5. **Los identificadores son texto, no números,** y no se reutilizan jamás.
6. **Fechas en `AAAA-MM-DD` y horas en `HH:MM`,** siempre como texto plano, para que no dependan de la configuración regional de quien abra la hoja.
7. **Los campos con lista cerrada** usan validación de datos apuntando a la pestaña `listas`. Así no conviven "Comida", "comida" y "COMIDA" como tres cosas distintas.

### Formato de los identificadores

`prefijo_AAAAMMDD_xxxx` — por ejemplo `reg_20260913_a7f3`. Los genera la app; a
mano basta con inventar algo que no exista.

---

## El cambio importante: `menu_casa` y `registro_nino`

La hoja actual tiene una fila por día y una columna por cosa:

| Día | Informante | Comida | Cena | Fruta | Caca Niña2 | Ducha | Lavado pelo Niña2 | Lavado pelo Niño1 | Otras anotaciones |

Eso funciona hasta que hace falta apuntar algo nuevo, y entonces hay que crear
una columna por cada cosa **y por cada niño**: ya hay `Caca Niña2`,
`Lavado pelo Niña2` y `Lavado pelo Niño1`, y faltan `Caca Niño1`, `Ducha Niña2`,
`Ducha Niño1`… La hoja crece a lo ancho hasta que deja de caber en una pantalla
y nadie la rellena.

El arreglo no es poner una fila por niño, porque **la mitad de los datos no son
de un niño: son de la casa.** La cena se cocina una vez para los dos. Duplicarla
en dos filas obliga a escribirla dos veces y a que las dos copias puedan
contradecirse.

Así que van dos pestañas, que es exactamente como funciona la realidad:

| | Qué guarda | Una fila por |
|---|---|---|
| **`menu_casa`** | Lo que se ha cocinado: comida, cena, fruta | día + casa |
| **`registro_nino`** | Lo que le pasa a cada uno: caca, ducha, lavado de pelo, cómo ha comido, medicación, ánimo | cada hecho |

Con esto, añadir "medicación" o "ánimo" mañana no toca la estructura: es un
valor más en la lista `registro_tipo`. Y sigue siendo fácil de rellenar a mano.

Un detalle heredado de vuestra hoja que merece conservarse: **apuntar el "no"
también es información.** Que Niña2 no haya hecho caca es un dato, no un hueco.
Por eso `valor` admite `si` y `no`, y una fila ausente significa "no se miró",
que es distinto.

---

## Pestañas

### `config`
Parámetros generales. `clave`, `valor`, `notas`.

| clave | valor |
|---|---|
| `version_esquema` | `1` |
| `curso_escolar` | `2026-2027` |
| `zona_horaria` | `Europe/Madrid` |
| `centro_escolar` | *por completar* |
| `calendar_id_custodia` | *por completar — el calendario de Google que ya usáis* |
| `calendar_id_colegio` | *opcional* |
| `carpeta_menus` | *id de la carpeta de Drive con el menú del comedor en imagen: una por mes, llamada `AAAA-MM.jpg` (o `.png`). Opcional* |
| `entorno` | `produccion` · en la copia de pruebas, `pruebas` |

---

### `personas`
`id` · `nombre` · `rol` · `email` · `color_hex` · `activo`

`rol`: `progenitor` · `cuidador` · `nino`

Ya vienen `per_papa`, `per_mama` y `per_abu` (la abuela). La abuela aparece
como `cuidador`: puede ser autora de un apunte aunque todavía no entre en la
app. El campo `autor_id` de cada apunte apunta aquí.

---

### `ninos`
`id` · `nombre` · `fecha_nacimiento` · `curso` · `grupo` · `centro` ·
`color_hex` · `alergias` · `notas_medicas` · `activo`

| id | nombre | curso | grupo | color |
|---|---|---|---|---|
| `nin_nino1` | Niño1 | 1º de Primaria | A | `#00838F` |
| `nin_nina2` | Niña2 | Infantil 4 | B | `#C2185B` |

`alergias` y `notas_medicas` son lo que un cuidador debería poder leer en diez
segundos. Van siempre visibles en la ficha, no enterradas.

---

### `custodia_mapeo`
El calendario de Google es la fuente de verdad de la custodia, pero los eventos
que ya existen tienen el título que tienen. Esta pestaña le enseña a la app a
interpretarlos, sin obligar a reescribir el calendario.

`texto_evento` · `coincidencia` (`exacta` · `contiene` · `empieza_por`) ·
`persona_id` · `nino_id` (vacío = los dos) · `notas`

`texto_evento` es lo que se busca en el título del evento del calendario: el
código que usáis allí. `persona_id` es siempre un `id` de la pestaña `personas`,
nunca el código del calendario.

| texto_evento | coincidencia | persona_id | nino_id |
|---|---|---|---|
| `PAPA` | `contiene` | `per_papa` | *(vacío)* |
| `MAMA` | `contiene` | `per_mama` | *(vacío)* |

Si una regla apunta a un `persona_id` que no existe en `personas`, la app no la
usa y la custodia de esos días sale vacía.

---

### `horario_centro`
Entrada y salida del colegio. Se rellena una vez por curso.

`id` · `nino_id` · `curso_escolar` · `entrada_desde` · `entrada_hasta` ·
`salida_desde` · `salida_hasta` · `puerta` · `notas` · `activo`

| niño | entrada | salida | puerta | notas |
|---|---|---|---|---|
| Niño1 | 09:00 | 17:00 | Principal | |
| Niña2 | 09:00 | 17:00 | Principal | |

Esta pestaña y la siguiente son las que permiten que la app conteste sola a la
pregunta diaria de verdad: **a qué hora y por dónde se recoge hoy a cada uno.**

---

### `horario_lectivo`
El horario de clases. Se rellena una vez por curso y no se toca.

`id` · `nino_id` · `curso_escolar` · `dia_semana` (1 lunes … 5 viernes) ·
`orden` · `hora_inicio` · `hora_fin` · `asignatura` · **`equipamiento`** ·
`aula` · `profesor` · `activo`

`equipamiento` es vuestra nomenclatura del papel, tal cual:

| código | significa |
|---|---|
| `CH` | chándal |
| `PS` | material de piscina |
| `CH+PS` | las dos cosas |

Está cargado el horario completo de los dos, tal como sale en la app del
colegio. Su fuente es `scripts/datos/horario_lectivo_2026-2027.json`: de ahí lo
toma `generar_hoja.py` para la plantilla y `scripts/cargar_horario.js` para
volcarlo en una hoja a través del backend, sin duplicar filas. Cada clase dura
hasta que empieza la siguiente; la última, hasta la salida del niño.

Las clases con equipamiento:

| niño | día | clase | equipamiento |
|---|---|---|---|
| Niño1 | martes | Educación física | `CH` |
| Niño1 | miércoles | Natación | `CH+PS` |
| Niño1 | viernes | Educación física | `CH` |
| Niña2 | jueves | Natación | `CH+PS` |
| Niña2 | viernes | Psicomotricidad | `CH` |

Un día sin cole (festivo, no lectivo o vacaciones en `calendario_escolar`) no
muestra ninguna clase, aunque el horario sea fijo.

---

### `extraescolares`
Las actividades de después del colegio, que son las que cambian la hora de
recogida.

`id` · `nino_id` · `curso_escolar` · `dia_semana` · `actividad` ·
`hora_inicio` · `hora_fin` · `equipamiento` · `lugar` · `fecha_desde` ·
`fecha_hasta` · `coste_mes` · `pagado_por` · `notas` · `activo`

| niño | día | actividad | recogida | desde | primera sesión |
|---|---|---|---|---|---|
| Niño1 | martes | Fútbol | 18:00 | 01/10 | mar 06/10 |
| Niño1 | jueves | Fútbol | 18:00 | 02/10 | jue 08/10 |
| Niño1 | viernes | Robótica | 14:00–15:00 *(mediodía)* | 01/10 | vie 02/10 |
| Niña2 | martes | Gimnasia | 18:15 | 01/10 | mar 06/10 |
| Niña2 | miércoles | Baile | 18:15 | 07/10 | mié 07/10 |

**`fecha_desde` no es el día de la primera clase, sino a partir de cuándo
arranca la actividad.** Todas empiezan pasado el 01/10, y la primera sesión de
cada una es el primer día de la semana que le corresponda en esa fecha o
después. Por eso las fechas del papel no cuadran con los días: no pretendían
hacerlo. La app tiene que calcular la primera sesión, no dar por hecho que
`fecha_desde` cae en el día correcto.

En el papel, el Fútbol de los martes de Niño1 no llevaba fecha. Se ha puesto el
01/10 como el resto; si empezó antes, basta con cambiar esa celda.

`hora_fin` es la hora real a la que hay que estar allí. La app la usa en lugar
de la salida ordinaria del `horario_centro` los días que hay actividad.

---

### `calendario_escolar`
`id` · `fecha` · `ambito` (`centro` o un `nino_id`) · `tipo` · `descripcion`

`tipo`: `festivo` · `no_lectivo` · `vacaciones` · `jornada_reducida` · `evento`

Se rellena con el calendario que dé el colegio.

---

### `menu_casa`
Qué se ha cocinado ese día en esa casa. **Una fila por día y casa.**

`id` · `creado_en` · `fecha` · `casa_persona_id` · `comida` · `cena` ·
`fruta` · `notas` · `autor_id` · `eliminado_en`

Es literalmente vuestra hoja actual sin las columnas de niño. `notas` es la
antigua *"Otras anotaciones"* y `autor_id` es *"Informante"*.

---

### `registro_nino`
Una fila por cada cosa que le pasa a **un** niño.

`id` · `creado_en` · `fecha` · `hora` · `nino_id` · `tipo` · `valor` ·
`escala` · `casa_persona_id` · `notas` · `autor_id` · `eliminado_en`

`tipo`: `desayuno` · `comida` · `merienda` · `cena` · `caca` · `pipi` ·
`ducha` · `bano` · `lavado_pelo` · `medicacion` · `animo` · `sueno` ·
`observacion`

- `valor` — `si` / `no` en caca, ducha, lavado de pelo; texto libre en medicación y observación.
- `escala` — de 1 a 5. En las comidas: 1 nada, 3 normal, 5 todo. En el ánimo: 1 muy mal, 5 muy bien. Vacío si no aplica.
- `casa_persona_id` — en qué casa ocurrió. Lo rellena sola la app a partir de la custodia de ese día.

---

### `salud_eventos`
`id` · `creado_en` · `fecha` · `nino_id` · `tipo` · `titulo` · `descripcion` ·
`profesional` · `centro` · `diagnostico` · `tratamiento` · `desde` · `hasta` ·
`adjunto_url` · `autor_id` · `eliminado_en`

`tipo`: `consulta` · `urgencia` · `vacuna` · `sintoma` · `medicacion` ·
`alergia` · `revision` · `dentista` · `otro`

`desde` y `hasta` acotan la pauta de un tratamiento. Mientras esté vigente, la
app la recuerda al apuntar medicación y la muestra en la ficha del niño.

---

### `salud_medidas`
`id` · `fecha` · `nino_id` · `peso_kg` · `talla_cm` · `notas` · `autor_id`

Separado de lo anterior porque es lo que se dibuja en una gráfica.

---

### `tareas`
`id` · `creado_en` · `nino_id` · `asignatura` · `titulo` · `descripcion` ·
`tipo` · `fecha_asignada` · `fecha_entrega` · `estado` · `prioridad` ·
`completada_en` · `autor_id` · `eliminado_en`

`tipo`: `deber` · `examen` · `trabajo` · `proyecto` · `entrega` · `lectura`
`estado`: `pendiente` · `en_curso` · `hecha` · `entregada`

---

### `lecturas`
`id` · `nino_id` · `titulo` · `autor` · `fecha_inicio` · `fecha_fin` ·
`paginas_totales` · `paginas_leidas` · `minutos` · `valoracion` (1-5) ·
`comentario` · `autor_id` · `eliminado_en`

---

### `eventos`
Colonias, excursiones, reuniones con el tutor, cumpleaños.

`id` · `nino_id` (vacío = los dos) · `titulo` · `tipo` · `fecha_inicio` ·
`fecha_fin` · `hora_inicio` · `hora_fin` · `lugar` · `coste` · `pagado_por` ·
`notas` · `calendar_event_id` · `autor_id` · `eliminado_en`

`tipo`: `colonias` · `excursion` · `extraescolar` · `reunion_tutor` ·
`cumple` · `otro`

En `notas` va lo que hay que llevar. `calendar_event_id` lo rellena la app al
volcar el evento a Google Calendar.

---

### `menu_comedor`
`id` · `fecha` · `centro` · `primero` · `segundo` · `postre` · `alergenos` ·
`origen` (`manual` · `foto` · `pdf`) · `autor_id`

Se rellena cuando el colegio manda el menú del mes.

---

### `listas`
Una columna por campo de lista cerrada, con sus valores válidos debajo. Es a lo
que apunta la validación de datos del resto de pestañas. Cambiar un valor aquí
lo cambia en toda la hoja.

Columnas: `rol` · `registro_tipo` · `salud_tipo` · `tarea_tipo` ·
`tarea_estado` · `evento_tipo` · `calendario_tipo` · `coincidencia` ·
`menu_origen` · `prioridad` · `equipamiento` · `si_no`

---

### `log`
`id` · `timestamp` · `autor_id` · `accion` (`crear`·`editar`·`borrar`) ·
`pestana` · `registro_id` · `campo` · `valor_anterior` · `valor_nuevo` ·
`origen` (`app`·`manual`)

La escribe la app sola. En una familia de dos casas esto no es burocracia: es
lo que evita que una discusión sobre quién apuntó o borró algo se convierta en
una discusión sobre quién dice la verdad.

---

## Puesta en marcha

**No se vuelca el histórico.** Se empieza de cero con el curso 2026-2027. Eso
ahorra el paso más pesado de todos y evita arrastrar a la estructura nueva datos
apuntados con criterios de la vieja. La hoja anterior se queda tal cual, de
consulta.

1. **Subir `2casas-hoja-control.xlsx` a Drive y abrirlo como Hoja de cálculo de Google.** Las pestañas, las cabeceras, las listas y las validaciones ya vienen puestas, y buena parte de los datos fijos también.
2. **Completar lo marcado como COMPLETAR:** nombre del colegio, id del calendario, correos de cada uno, fechas de nacimiento, alergias.
3. **Ajustar `custodia_mapeo`** a los títulos que usáis de verdad en el calendario.
4. **Borrar las filas amarillas.** Son ejemplos del formato esperado.
5. **Compartir con las personas concretas**, nunca por enlace público: ahí dentro hay datos de salud de menores.
6. **Dejar la hoja antigua en solo lectura**, renombrada con `ARCHIVO —` delante. No borrarla: es el historial del curso pasado.
