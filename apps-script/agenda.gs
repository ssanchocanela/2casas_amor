/**
 * La vista compuesta de un día: todo lo que pinta la pantalla "Hoy",
 * en una sola llamada.
 *
 * Lo interesante de este fichero son 'calcularRecogida' y 'calcularEquipamiento':
 * no leen un dato guardado, lo deducen. Son las dos preguntas de cada tarde.
 */

function accionAgenda(datos) {
  const fecha = datos.fecha || hoy();
  const manana = sumarDias(fecha, 1);

  const ninos = leerVigentes('ninos').filter((n) => n.activo !== 'no');
  // Una sola ida al calendario: sirve para hoy y para buscar el próximo cambio.
  const custodia = leerCustodia(fecha, sumarDias(fecha, 21));

  const porNino = ninos.map((nino) => ({
    nino_id: nino.id,
    nombre: nino.nombre,
    color_hex: nino.color_hex,
    custodia: (custodia[fecha] && custodia[fecha][nino.id]) || null,
    // Un día sin cole (fin de semana, festivo, vacaciones) no trae clases,
    // aunque el horario sea fijo para todo el curso.
    clases: hayClase(fecha) ? clasesDe(nino.id, fecha) : [],
    recogida: calcularRecogida(nino.id, fecha),
    equipamiento_manana: calcularEquipamiento(nino.id, manana),
  }));

  return {
    ok: true,
    fecha: fecha,
    dia_semana: diaSemana(fecha),
    escolar: escolarDe(fecha),
    ninos: porNino,
    proximo_cambio: proximoCambio(fecha, custodia),
    menu_comedor: unaFila('menu_comedor', (f) => f.fecha === fecha),
    menu_casa: leerVigentes('menu_casa').filter((f) => f.fecha === fecha),
    registro: leerVigentes('registro_nino').filter((f) => f.fecha === fecha),
    tareas_vencen: leerVigentes('tareas').filter(
      (t) => (t.fecha_entrega === fecha || t.fecha_entrega === manana) &&
             t.estado !== 'entregada' && t.estado !== 'hecha'
    ),
    eventos: leerVigentes('eventos').filter(
      (e) => e.fecha_inicio && e.fecha_inicio <= fecha &&
             (!e.fecha_fin || e.fecha_fin >= fecha)
    ),
    tratamientos_activos: leerVigentes('salud_eventos').filter(
      (s) => s.tipo === 'medicacion' && s.desde && s.desde <= fecha &&
             (!s.hasta || s.hasta >= fecha)
    ),
  };
}

/**
 * A qué hora y por dónde hay que recoger a un niño ese día.
 *
 * Manda la extraescolar sobre la salida ordinaria: si hay actividad, se sale
 * cuando termina la actividad. Si el día no es lectivo, no hay recogida.
 */
function calcularRecogida(ninoId, fecha) {
  const escolar = escolarDe(fecha);
  if (escolar && (escolar.tipo === 'festivo' || escolar.tipo === 'no_lectivo' ||
                  escolar.tipo === 'vacaciones')) {
    return { hay: false, motivo: escolar.tipo, descripcion: escolar.descripcion || '' };
  }
  if (diaSemana(fecha) > 5) {
    return { hay: false, motivo: 'fin_de_semana' };
  }

  const centro = leerVigentes('horario_centro').filter(
    (h) => h.nino_id === ninoId && h.activo !== 'no'
  )[0];

  const actividades = extraescolaresDe(ninoId, fecha)
    .filter((e) => e.hora_fin)
    // La actividad de mediodía no cambia la hora de salida de la tarde.
    .filter((e) => !e.hora_inicio || e.hora_inicio >= '15:00');

  if (actividades.length) {
    const ultima = actividades.sort((a, b) => (a.hora_fin < b.hora_fin ? 1 : -1))[0];
    return {
      hay: true,
      hora: ultima.hora_fin,
      motivo: 'extraescolar',
      actividad: ultima.actividad,
      lugar: ultima.lugar || (centro ? centro.puerta : ''),
      notas: ultima.notas || '',
    };
  }

  if (!centro) return { hay: true, hora: null, motivo: 'sin_horario' };

  return {
    hay: true,
    hora: centro.salida_desde,
    hora_hasta: centro.salida_hasta,
    motivo: 'salida_ordinaria',
    lugar: centro.puerta,
    notas: centro.notas || '',
  };
}

/**
 * Qué hay que llevar ese día: CH chándal, PS piscina, CH+PS las dos cosas.
 * Sale tanto de las clases como de las extraescolares.
 */
function calcularEquipamiento(ninoId, fecha) {
  if (diaSemana(fecha) > 5) return [];
  const escolar = escolarDe(fecha);
  if (escolar && (escolar.tipo === 'festivo' || escolar.tipo === 'no_lectivo' ||
                  escolar.tipo === 'vacaciones')) {
    return [];
  }

  const codigos = {};
  const anotar = (origen, codigo) => {
    if (!codigo) return;
    String(codigo).split('+').forEach((c) => {
      c = c.trim().toUpperCase();
      if (!c) return;
      if (!codigos[c]) codigos[c] = [];
      codigos[c].push(origen);
    });
  };

  clasesDe(ninoId, fecha).forEach((c) => anotar(c.asignatura, c.equipamiento));
  extraescolaresDe(ninoId, fecha).forEach((e) => anotar(e.actividad, e.equipamiento));

  const nombres = { CH: 'chándal', PS: 'material de piscina' };
  return Object.keys(codigos).map((c) => ({
    codigo: c,
    nombre: nombres[c] || c,
    porque: codigos[c],
  }));
}

/** Las clases de un niño ese día, ordenadas. */
function clasesDe(ninoId, fecha) {
  const dia = diaSemana(fecha);
  const curso = leerConfig().curso_escolar;
  return leerVigentes('horario_lectivo')
    .filter((h) => h.nino_id === ninoId &&
                   Number(h.dia_semana) === dia &&
                   h.activo !== 'no' &&
                   (!curso || !h.curso_escolar || h.curso_escolar === curso))
    .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
}

/**
 * Las extraescolares de un niño ese día.
 * 'fecha_desde' es a partir de cuándo arranca la actividad, no el día de la
 * primera clase: por eso se compara con la fecha, no con el día de la semana.
 */
function extraescolaresDe(ninoId, fecha) {
  const dia = diaSemana(fecha);
  const curso = leerConfig().curso_escolar;
  return leerVigentes('extraescolares').filter(
    (e) => e.nino_id === ninoId &&
           Number(e.dia_semana) === dia &&
           e.activo !== 'no' &&
           (!curso || !e.curso_escolar || e.curso_escolar === curso) &&
           (!e.fecha_desde || fecha >= e.fecha_desde) &&
           (!e.fecha_hasta || fecha <= e.fecha_hasta)
  );
}

function escolarDe(fecha) {
  return unaFila('calendario_escolar', (f) => f.fecha === fecha);
}

/** Si ese día hay cole: entre semana y sin festivo, día no lectivo ni vacaciones. */
function hayClase(fecha) {
  if (diaSemana(fecha) > 5) return false;
  const escolar = escolarDe(fecha);
  return !(escolar && (escolar.tipo === 'festivo' || escolar.tipo === 'no_lectivo' ||
                       escolar.tipo === 'vacaciones'));
}

/**
 * Cuándo cambia la custodia a partir de una fecha. Mira 21 días por delante.
 * 'custodia' es opcional: la agenda la pasa ya leída para no ir dos veces al
 * calendario, que es lo más lento de todo.
 */
function proximoCambio(fecha, custodia) {
  if (!custodia) custodia = leerCustodia(fecha, sumarDias(fecha, 21));
  const dias = Object.keys(custodia).sort();
  if (!dias.length) return null;

  const inicial = JSON.stringify(custodia[dias[0]] || {});
  for (let i = 1; i < dias.length; i++) {
    if (JSON.stringify(custodia[dias[i]] || {}) !== inicial) {
      return { fecha: dias[i], custodia: custodia[dias[i]] };
    }
  }
  return null;
}

// ── utilidades de fecha ──────────────────────────────────────────────

/** 1 lunes … 7 domingo. */
function diaSemana(fecha) {
  const d = new Date(fecha + 'T12:00:00');
  return ((d.getDay() + 6) % 7) + 1;
}

function sumarDias(fecha, n) {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, ZONA, 'yyyy-MM-dd');
}

function unaFila(tabla, filtro) {
  const encontradas = leerVigentes(tabla).filter(filtro);
  return encontradas.length ? encontradas[0] : null;
}
