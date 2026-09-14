# 2 Casas + Amor

App familiar para coordinar el día a día de los niños entre dos casas:
custodia, registro diario, colegio y menú del comedor.

> **Versión pública con datos ficticios.** Los niños se llaman Niño1 y Niña2, el
> colegio es «Colegio Ejemplo» y el horario es de ejemplo. No hay credenciales:
> la dirección del backend y los tokens se introducen en la app.

## Dónde está cada cosa

| Documento | Qué contiene |
|---|---|
| [`docs/01-plan.md`](docs/01-plan.md) | Qué es, para quién, decisiones tomadas, fases, riesgos y coste |
| [`docs/02-hoja-de-calculo.md`](docs/02-hoja-de-calculo.md) | El esquema de la hoja de Google, pestaña a pestaña. **Es el contrato del proyecto** |
| [`docs/03-arquitectura.md`](docs/03-arquitectura.md) | Stack, API de Apps Script, sincronización offline, seguridad |
| [`docs/04-app.md`](docs/04-app.md) | Pantallas, flujos y decisiones de diseño |
| [`CLAUDE.md`](CLAUDE.md) | Reglas de trabajo para Claude Code |

## En resumen

Los datos se quedan en Google: **Calendar** para la custodia (el calendario que
ya existe) y **Sheets** para todo lo demás, reestructurada con un esquema
estricto. El backend es un **Apps Script** publicado como aplicación web, que
vive dentro de la propia hoja: sin servidores, sin coste y sin pantallas de
consentimiento de Google. La app es **React Native con Expo**, nativa en
Android e iOS, y con la misma base de código se puede generar versión web.

Todo se puede seguir editando a mano desde Drive, que era el requisito de
partida.

## Siguientes pasos

1. Crear la cuenta de Google neutral que será dueña de la hoja, el calendario y el script.
2. Subir `2casas-hoja-control.xlsx` a Drive y abrirlo como Hoja de cálculo de Google.
3. Completar lo marcado como COMPLETAR y ajustar `custodia_mapeo` a los títulos reales del calendario.
4. Borrar las filas amarillas de ejemplo y empezar a usarla.
5. Publicar el Apps Script y comprobar que la API responde.
6. Arrancar la app.

Los pasos 1 a 5 son la **fase 0** y no necesitan una sola línea de la app: al
terminarlos, la hoja ya es más útil que la actual.

Se empieza de cero con el curso 2026-2027. El histórico no se vuelca: la hoja
anterior se deja en solo lectura como archivo del curso pasado.
