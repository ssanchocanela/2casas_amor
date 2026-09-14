# 2 Casas + Amor — Visión y alcance

> Documento vivo. Última revisión: 13 de septiembre de 2026.

## 1. Qué es

Una aplicación familiar para coordinar el día a día de los niños entre dos casas.
No es una agenda más: es el sitio donde los dos progenitores miran para saber qué
pasa con los niños hoy, y donde apuntan lo que ha pasado, sin tener que
preguntárselo el uno al otro.

**Principio rector:** la app tiene que reducir conversaciones, no generarlas.
Si algo se puede consultar en la app en vez de preguntarlo por mensaje, la app
está funcionando.

## 2. Para quién

Los niños son **Niño1** (1º de Primaria, grupo A) y **Niña2** (Infantil 4, grupo B).

| Rol | Quién | Qué puede hacer |
|---|---|---|
| Progenitor | Padre y madre | Todo: ver y editar cualquier dato |
| *(futuro)* Cuidador | La abuela | Apuntar registro diario; sin acceso a salud ni a custodia |
| *(futuro)* Niño | Niño1 y Niña2 | Ver su horario, marcar tareas hechas, apuntar lecturas |

En la primera versión solo entra el rol **Progenitor**, pero la abuela ya existe
como persona en los datos desde el principio (`per_abu`): puede ser autora de un
apunte aunque todavía no sea usuaria. Darle acceso en la fase 3 será añadirle un
rol, no rehacer el modelo.

## 3. Decisiones tomadas

| Decisión | Elección | Motivo |
|---|---|---|
| Dónde viven los datos | **Google Calendar + Google Sheets** | Se sigue pudiendo editar a mano desde Drive, que es cómodo y ya es costumbre. |
| Arranque | **De cero con el curso 2026-2027** | No se vuelca el histórico. La hoja anterior se queda en solo lectura como archivo del curso pasado. |
| Fuente de verdad de la custodia | **Google Calendar** (el que ya existe) | Ya está montado y se consulta desde el móvil sin abrir nada más. |
| Forma de la app | **Nativa Android**, con React Native + Expo | Solo Android: se instala el `.apk` directamente, sin tiendas ni cuentas de desarrollador. Si algún día hace falta un iPhone, Expo genera versión web con el mismo código. |
| Backend | **Google Apps Script** publicado como Web App | Vive dentro de la propia hoja. Sin servidores, sin coste, sin pantallas de consentimiento de Google, sin verificación de app. |
| Propiedad de los datos | Cuenta de Google **neutral** dueña de la hoja, el calendario y el script | Los datos son de los dos. Cada uno entra con su cuenta personal, a la que se le da acceso. |

### Coste

**Cero euros.** Google Sheets, Calendar y Apps Script entran en el plan
gratuito con muchísimo margen, y el `.apk` de Android se instala directamente
sin pasar por Google Play ni por ninguna cuenta de desarrollador.

Al descartar iOS desaparece el único coste que tenía el proyecto: los 99 €/año
de cuenta de desarrollador de Apple. Si algún día entra un iPhone, la salida es
la versión web instalable que Expo genera con el mismo código, no rehacer nada.

## 4. Alcance de la primera versión

Las cuatro áreas, todas en fase 1:

### 4.1 Custodia — quién los tiene cada día
- Calendario mensual y semanal con el reparto visible de un vistazo, un color por progenitor.
- En la pantalla de inicio, quién tiene a cada niño **hoy** y cuándo es el próximo cambio.
- Marcar intercambios puntuales sin romper la pauta habitual.
- Recuento de días por progenitor en un periodo (útil para vacaciones y para cualquier revisión del convenio).

### 4.2 Registro diario
Lo que hoy está en la hoja: comidas, duchas, cacas y observaciones.
- Apuntar en dos toques desde la pantalla de inicio, sin navegar.
- Cada apunte guarda **en qué casa** ocurrió y **quién lo apuntó**.
- Vista de día y vista de semana, para ver de un vistazo si lleva tres días sin hacer caca o si no ha cenado en dos noches.
- Funciona sin cobertura: se guarda en el móvil y sube solo cuando hay red.

### 4.3 Colegio
- **Recogida de hoy**: a qué hora y por qué puerta hay que estar allí, contando las extraescolares de ese día. Es la consulta más frecuente del día y hoy vive en un papel pegado a la nevera.
- **Qué hay que llevar mañana**: chándal, piscina o las dos cosas, a partir del horario y las extraescolares.
- **Horario lectivo** fijo, digitalizado una vez por curso. Qué toca ahora y qué toca mañana.
- **Extraescolares**: Fútbol, Robótica, Gimnasia y Baile, con su hora de recogida y su fecha de inicio.
- **Calendario escolar**: festivos, días no lectivos, jornada reducida, vacaciones.
- **Tareas y entregas**: deberes, exámenes, trabajos, con fecha de entrega y estado.
- **Lecturas**: qué está leyendo cada uno, cuánto lleva, qué le ha parecido.
- **Eventos**: colonias, excursiones, reuniones con el tutor, extraescolares.

### 4.4 Menú del comedor
- Volcado del menú del mes desde la app (a mano o a partir de una foto del menú).
- Visible en la pantalla de inicio junto a lo que ha comido en casa, para no repetir cena.

## 5. Lo que NO entra en la primera versión

Se deja fuera a propósito, para poder tener algo usable pronto:

- Chat o mensajería entre progenitores (ya tenéis WhatsApp; meter esto aquí convierte la app en un campo de batalla).
- Gastos compartidos y liquidación.
- Adjuntos y fotos (informes médicos, circulares del cole).
- Gráficas de evolución de peso y talla.
- Acceso de los niños.
- Exportación en PDF del historial.

## 6. Fases

| Fase | Qué | Resultado |
|---|---|---|
| **0. Cimientos** | Montar la hoja con el esquema de `02-hoja-de-calculo.md`, empezando de cero con el curso 2026-2027. Completar los datos fijos. Publicar el Apps Script. | La hoja ya es utilizable a mano y hay una API que la lee. |
| **1. App usable** | Las cuatro áreas del punto 4. Pantalla de inicio, calendario, ficha de niño, apuntar rápido, ajustes. | La app sustituye al uso diario de la hoja. |
| **2. Vida cotidiana** | Notificaciones (cambio de custodia mañana, entrega mañana, medicación). Adjuntos y fotos. Gráficas de salud. Recuento de días. | Deja de hacer falta acordarse de mirar. |
| **3. Ampliación** | Acceso de los niños. Gastos compartidos. Exportación en PDF. Cuidadores. | |

## 7. Riesgos conocidos

| Riesgo | Mitigación |
|---|---|
| Alguien rompe la estructura de la hoja editando a mano | Esquema estricto documentado, validación de datos en las columnas enumeradas, pestaña `config` con `version_esquema`, y la app avisa si no cuadra |
| Dos escrituras simultáneas se pisan | `LockService` en el Apps Script; todas las escrituras pasan por él |
| La hoja crece y se vuelve lenta | El esquema está pensado para migrar a una base de datos real sin rediseñar: cada pestaña ya es una tabla. Se revisa al superar ~20.000 filas |
| Discusiones sobre quién apuntó o borró qué | Pestaña `log` de auditoría y borrado lógico: nada se elimina nunca de verdad |
| Datos de salud de menores expuestos | Nunca compartir por enlace público; solo acceso nominal. Verificación en dos pasos obligatoria en las tres cuentas |

## 8. Cómo se mide que funciona

A los dos meses de uso:

- ¿Se ha dejado de preguntar por mensaje "quién los tiene el viernes"?
- ¿Se apunta el registro diario los días que toca, o se abandona a la semana?
- ¿Se ha mirado el menú del comedor antes de hacer la cena alguna vez?

Si la respuesta a la segunda es que no, el problema es que apuntar cuesta
demasiado, y eso es un problema de diseño de la pantalla de inicio, no de
voluntad.
