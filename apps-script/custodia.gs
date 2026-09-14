/**
 * La custodia vive en Google Calendar, no en la hoja.
 *
 * El calendario ya existía antes que la app y se sigue usando desde el móvil,
 * así que la app se adapta a los títulos que ya tiene, en vez de obligar a
 * reescribirlos. La traducción está en la pestaña 'custodia_mapeo'.
 */

function accionCustodia(datos) {
  const desde = datos.desde || hoy();
  const hasta = datos.hasta || sumarDias(desde, 30);
  return { ok: true, desde: desde, hasta: hasta, dias: leerCustodia(desde, hasta) };
}

/**
 * Devuelve { 'AAAA-MM-DD': { nino_id: { persona_id, nombre, color_hex, titulo } } }
 */
function leerCustodia(desde, hasta) {
  const config = leerConfig();
  const idCalendario = config.calendar_id_custodia;
  if (!idCalendario) return {};

  const calendario = CalendarApp.getCalendarById(idCalendario);
  if (!calendario) {
    console.error('No se encuentra el calendario ' + idCalendario);
    return {};
  }

  const mapeo = leerVigentes('custodia_mapeo');
  const personas = {};
  leerVigentes('personas').forEach((p) => { personas[p.id] = p; });
  const ninos = leerVigentes('ninos').filter((n) => n.activo !== 'no');

  const eventos = calendario.getEvents(
    new Date(desde + 'T00:00:00'),
    new Date(sumarDias(hasta, 1) + 'T00:00:00')
  );

  const dias = {};
  eventos.forEach((evento) => {
    const titulo = evento.getTitle();
    const reglas = mapeo.filter((m) => coincide(titulo, m.texto_evento, m.coincidencia));
    if (!reglas.length) return;

    // Un evento de día completo termina a las 00:00 del día siguiente.
    const inicio = Utilities.formatDate(evento.getStartTime(), ZONA, 'yyyy-MM-dd');
    let fin = Utilities.formatDate(evento.getEndTime(), ZONA, 'yyyy-MM-dd');
    if (evento.isAllDayEvent()) fin = sumarDias(fin, -1);
    if (fin < inicio) fin = inicio;

    reglas.forEach((regla) => {
      const persona = personas[regla.persona_id];
      if (!persona) return;
      const destinatarios = regla.nino_id ? [regla.nino_id] : ninos.map((n) => n.id);

      let f = inicio;
      let guarda = 0;
      while (f <= fin && guarda++ < 400) {
        if (f >= desde && f <= hasta) {
          if (!dias[f]) dias[f] = {};
          destinatarios.forEach((ninoId) => {
            dias[f][ninoId] = {
              persona_id: persona.id,
              nombre: persona.nombre,
              color_hex: persona.color_hex,
              titulo: titulo,
            };
          });
        }
        f = sumarDias(f, 1);
      }
    });
  });

  return dias;
}

function coincide(titulo, patron, modo) {
  if (!patron) return false;
  const t = String(titulo).toLowerCase().trim();
  const p = String(patron).toLowerCase().trim();
  switch (modo) {
    case 'exacta':      return t === p;
    case 'empieza_por': return t.indexOf(p) === 0;
    default:            return t.indexOf(p) >= 0; // 'contiene'
  }
}

/**
 * Crea o actualiza un evento en el calendario a partir de una fila de 'eventos'.
 * Guarda el id devuelto en 'calendar_event_id' para no duplicarlo la próxima vez.
 */
function accionEventoCalendar(datos, autorId) {
  const id = datos.id;
  if (!id) return { ok: false, error: 'falta_id' };

  const evento = leerVigentes('eventos').filter((e) => e.id === id)[0];
  if (!evento) return { ok: false, error: 'evento_no_encontrado' };

  const config = leerConfig();
  const idCalendario = config.calendar_id_colegio || config.calendar_id_custodia;
  if (!idCalendario) return { ok: false, error: 'sin_calendario_configurado' };

  const calendario = CalendarApp.getCalendarById(idCalendario);
  if (!calendario) return { ok: false, error: 'calendario_no_encontrado' };

  const ninos = {};
  leerVigentes('ninos').forEach((n) => { ninos[n.id] = n.nombre; });
  const quien = evento.nino_id ? (ninos[evento.nino_id] || '') : 'Niño1 y Niña2';
  const titulo = quien ? quien + ' · ' + evento.titulo : evento.titulo;

  const inicio = new Date(evento.fecha_inicio + 'T' + (evento.hora_inicio || '00:00') + ':00');
  const finFecha = evento.fecha_fin || evento.fecha_inicio;
  const todoElDia = !evento.hora_inicio;

  let creado;
  if (evento.calendar_event_id) {
    try {
      const existente = calendario.getEventById(evento.calendar_event_id);
      if (existente) existente.deleteEvent();
    } catch (err) {
      console.error('No se pudo borrar el evento anterior: ' + err);
    }
  }

  if (todoElDia) {
    creado = (finFecha === evento.fecha_inicio)
      ? calendario.createAllDayEvent(titulo, inicio)
      : calendario.createAllDayEvent(titulo, inicio, new Date(sumarDias(finFecha, 1) + 'T00:00:00'));
  } else {
    const fin = new Date(finFecha + 'T' + (evento.hora_fin || evento.hora_inicio) + ':00');
    creado = calendario.createEvent(titulo, inicio, fin);
  }

  if (evento.notas) creado.setDescription(evento.notas);
  if (evento.lugar) creado.setLocation(evento.lugar);

  actualizarFila('eventos', id, { calendar_event_id: creado.getId() }, autorId);
  return { ok: true, calendar_event_id: creado.getId() };
}
