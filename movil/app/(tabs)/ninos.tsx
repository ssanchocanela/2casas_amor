/**
 * NIÑOS — la ficha de cada uno: día a día, colegio y salud.
 *
 * Alergias y notas médicas van siempre arriba, fuera de las pestañas: es lo que
 * alguien puede necesitar leer en diez segundos.
 *
 * Lo que más se va a mirar es la rejilla de la semana. Ahí salta a la vista que
 * Niña2 lleva tres días sin hacer caca o que Niño1 no cena desde el martes, y por
 * eso un "no" apuntado, una casilla sin apuntar y un día que aún no ha llegado
 * se ven distintos. Tocar una casilla abre ese día.
 */

import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, PanResponder, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useSesion } from '../../src/estado/sesion';
import { useFilas } from '../../src/estado/lectura';
import { conPendientes } from '../../src/db/cola';
import { recordar, recuperar } from '../../src/db/cache';
import type {
  EventoEscolar, Lectura, MenuCasa, Nino, RegistroNino, SaludEvento, SaludMedida, Tarea,
} from '../../src/domain/tipos';
import { avisoSinSi, definicion, ultimaSemana } from '../../src/domain/apuntes';
import { cambiosFicha, conEstado, valoresDe } from '../../src/domain/fichas';
import { lunesDe, semanaDe } from '../../src/domain/calendario';
import {
  ahoraMadrid, diaCorto, diaYNumero, fechaCorta, hoyMadrid, letraDia, sumarDias,
} from '../../src/domain/fechas';
import {
  ETIQUETA_SALUD, agruparTareas, celda, filasRejilla, hecha, nombreEquipamiento, tablaHorario, tratamientosActivos,
} from '../../src/domain/ninos';
import { deshacer, type Deshacer } from '../../src/db/apuntar';
import { editarFicha } from '../../src/db/fichas';
import { useCola } from '../../src/estado/cola';
import AvisoDeshacer from '../../src/ui/AvisoDeshacer';
import HojaFicha, { type AbrirFicha } from '../../src/ui/fichas/HojaFicha';
import Segmento from '../../src/ui/Segmento';
import { color, espacio, letra, radio, tonoApunte } from '../../src/ui/tema';

type Pestana = 'dia' | 'colegio' | 'salud';

const PESTANAS: { clave: Pestana; texto: string }[] = [
  { clave: 'dia', texto: 'Día a día' },
  { clave: 'colegio', texto: 'Colegio' },
  { clave: 'salud', texto: 'Salud' },
];
/** El mismo que usa Apuntar: el último niño elegido, en cualquier sitio. */
const CLAVE_ULTIMO_NINO = 'ultimo_nino';
const DIAS_LECTIVOS = [1, 2, 3, 4, 5];
const NOMBRE_DIA = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie'];

const abrirDia = (fecha: string) => router.push(`/dia/${fecha}`);

export default function Ninos() {
  const { ninos } = useSesion();
  const { subir } = useCola();
  const [ninoId, setNinoId] = useState(() => recuperar<string>(CLAVE_ULTIMO_NINO) ?? '');
  const [pestana, setPestana] = useState<Pestana>('dia');
  // La ficha que se está añadiendo o corrigiendo, y el "deshacer" de después.
  const [ficha, setFicha] = useState<AbrirFicha | null>(null);
  const [aviso, setAviso] = useState<{ d: Deshacer; texto: string; clave: number } | null>(null);
  const nino = ninos.find((n) => n.id === ninoId) ?? ninos[0];

  if (!nino) return <View style={{ flex: 1, backgroundColor: color.fondo }} />;

  function elegir(id: string) {
    setNinoId(id);
    recordar(CLAVE_ULTIMO_NINO, id);
  }

  function guardada(d: Deshacer, texto: string) {
    setFicha(null);
    setAviso({ d, texto, clave: Date.now() });
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
    <ScrollView
      style={{ flex: 1, backgroundColor: color.fondo }}
      contentContainerStyle={{
        padding: espacio.l, paddingTop: (StatusBar.currentHeight ?? 24) + espacio.l, paddingBottom: espacio.xxl,
      }}
    >
      <Segmento
        opciones={ninos.map((n) => ({ valor: n.id, texto: n.nombre, tono: n.color_hex }))}
        valor={nino.id}
        alCambiar={elegir}
      />
      <DatosMedicos nino={nino} />

      <View style={{ flexDirection: 'row', gap: espacio.xl, marginTop: espacio.l, borderBottomWidth: 1, borderBottomColor: color.borde }}>
        {PESTANAS.map((p) => {
          const activa = p.clave === pestana;
          return (
            <Pressable
              key={p.clave}
              onPress={() => setPestana(p.clave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              style={{ paddingVertical: espacio.s, borderBottomWidth: 2, borderBottomColor: activa ? color.texto : 'transparent', marginBottom: -1 }}
            >
              <Text style={{ fontSize: 16, fontWeight: activa ? '700' : '400', color: activa ? color.texto : color.textoTenue }}>
                {p.texto}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {pestana === 'dia' && <DiaADia key={nino.id} nino={nino} />}
      {pestana === 'colegio' && <Colegio nino={nino} abrir={setFicha} alGuardar={guardada} />}
      {pestana === 'salud' && <Salud nino={nino} abrir={setFicha} />}
    </ScrollView>

    <HojaFicha abrir={ficha} alCerrar={() => setFicha(null)} alGuardar={guardada} />

    {aviso && (
      <AvisoDeshacer
        key={aviso.clave}
        texto={aviso.texto}
        alDeshacer={() => { if (deshacer(aviso.d)) subir(); setAviso(null); }}
        alTerminar={() => setAviso(null)}
      />
    )}
    </View>
  );
}

/** Siempre a la vista, en todas las pestañas. Si no hay nada, no ocupa sitio. */
function DatosMedicos({ nino }: { nino: Nino }) {
  if (!nino.alergias && !nino.notas_medicas) return null;
  return (
    <View style={{ backgroundColor: '#FDECEA', borderRadius: radio.m, padding: espacio.m, marginTop: espacio.m }}>
      {!!nino.alergias && (
        <Text style={{ color: color.error, fontSize: 15 }}>
          <Text style={{ fontWeight: '700' }}>Alergias: </Text>{nino.alergias}
        </Text>
      )}
      {!!nino.notas_medicas && (
        <Text style={{ color: color.error, fontSize: 15, marginTop: nino.alergias ? 2 : 0 }}>
          <Text style={{ fontWeight: '700' }}>Notas médicas: </Text>{nino.notas_medicas}
        </Text>
      )}
    </View>
  );
}

// ── día a día ─────────────────────────────────────────────────────────

function DiaADia({ nino }: { nino: Nino }) {
  const { personas } = useSesion();
  const hoy = hoyMadrid();
  const [lunes, setLunes] = useState(() => lunesDe(hoy));
  const dias = semanaDe(lunes);
  const domingo = dias[6];
  const esEstaSemana = lunes === lunesDe(hoy);
  const haceSeis = sumarDias(hoy, -6);

  const semana = useFilas<RegistroNino>('registro_nino', { desde: lunes, hasta: domingo, nino: nino.id });
  // Los últimos siete días, para el aviso: la misma lectura que usa Apuntar.
  const reciente = useFilas<RegistroNino>('registro_nino', { desde: haceSeis, hasta: hoy, nino: nino.id });
  const menus = useFilas<MenuCasa>('menu_casa', { desde: lunes, hasta: domingo });

  const registros = conPendientes('registro_nino', semana.filas,
    (r) => r.nino_id === nino.id && r.fecha >= lunes && r.fecha <= domingo);
  const aviso = avisoSinSi(ultimaSemana(
    conPendientes('registro_nino', reciente.filas, (r) => r.nino_id === nino.id && r.fecha >= haceSeis),
    nino.id, 'caca', hoy,
  ), hoy);
  const menusSemana = conPendientes('menu_casa', menus.filas, (m) => m.fecha >= lunes && m.fecha <= domingo);

  const mover = useRef((pasos: number) => {});
  mover.current = (pasos) => setLunes(sumarDias(lunes, 7 * pasos));
  const gesto = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 50) mover.current(g.dx < 0 ? 1 : -1); },
  })).current;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: espacio.l }}>
        <Pressable onPress={() => mover.current(-1)} hitSlop={12} accessibilityLabel="Semana anterior">
          <Text style={{ fontSize: 22, color: color.textoSuave }}>‹</Text>
        </Pressable>
        <Text style={[letra.seccion, { marginHorizontal: espacio.s }]}>
          SEMANA DEL {Number(lunes.slice(8))} AL {Number(domingo.slice(8))}
        </Text>
        <Pressable onPress={() => mover.current(1)} hitSlop={12} accessibilityLabel="Semana siguiente">
          <Text style={{ fontSize: 22, color: color.textoSuave }}>›</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {!esEstaSemana && (
          <Pressable onPress={() => setLunes(lunesDe(hoy))} hitSlop={8}>
            <Text style={[letra.tenue, { color: color.acento, fontWeight: '600' }]}>Esta semana</Text>
          </Pressable>
        )}
      </View>

      {aviso && <Aviso texto={`Caca: ${aviso.charAt(0).toLowerCase()}${aviso.slice(1)}`} />}

      <View {...gesto.panHandlers} style={[tarjeta, { marginTop: espacio.s, paddingHorizontal: espacio.s }]}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 74 }} />
          {dias.map((f) => (
            <View key={f} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[letra.tenue, { fontSize: 12 }]}>{letraDia(f)}</Text>
              <Text style={{ fontSize: 12, color: f === hoy ? color.texto : color.textoTenue, fontWeight: f === hoy ? '800' : '400' }}>
                {Number(f.slice(8))}
              </Text>
            </View>
          ))}
        </View>
        {filasRejilla(registros).map((tipo) => (
          <View key={tipo} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Text style={[letra.suave, { width: 74 }]} numberOfLines={1}>{definicion(tipo)?.etiqueta}</Text>
            {dias.map((f) => {
              const c = celda(registros, tipo, f, hoy);
              const tono = c.estado === 'futuro' ? null : tonoApunte[c.estado];
              return (
                <Pressable
                  key={f}
                  onPress={() => abrirDia(f)}
                  disabled={c.estado === 'futuro'}
                  accessibilityLabel={`${definicion(tipo)?.etiqueta}, ${diaYNumero(f)}: ${c.estado.replace('_', ' ')}`}
                  style={{
                    flex: 1, aspectRatio: 1, margin: 2, borderRadius: radio.s,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: tono?.fondo ?? 'transparent',
                  }}
                >
                  <Text style={{ color: tono?.texto ?? color.textoTenue, fontWeight: '700', fontSize: 15 }}>{c.marca}</Text>
                  {c.pendiente && (
                    <View style={{ position: 'absolute', top: 3, right: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color.pendiente }} />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: espacio.l, marginTop: espacio.s, paddingHorizontal: espacio.xs }}>
          <Text style={letra.tenue}><Text style={{ color: color.acento, fontWeight: '700' }}>✓</Text> sí</Text>
          <Text style={letra.tenue}><Text style={{ color: color.aviso, fontWeight: '700' }}>✗</Text> no</Text>
          <Text style={letra.tenue}>· sin apuntar</Text>
        </View>
      </View>

      <Text style={[letra.seccion, { marginTop: espacio.xl, marginBottom: espacio.s }]}>
        {esEstaSemana ? 'EN CASA ESTA SEMANA' : 'EN CASA ESA SEMANA'}
      </Text>
      <View style={tarjeta}>
        {dias.filter((f) => f <= hoy).length === 0 && (
          <Text style={letra.tenue}>Esta semana todavía no ha empezado.</Text>
        )}
        {dias.filter((f) => f <= hoy).map((f) => {
          const delDia = menusSemana.filter((m) => m.fecha === f);
          return (
            <Pressable key={f} onPress={() => abrirDia(f)} style={{ flexDirection: 'row', paddingVertical: 3 }}>
              <Text style={[letra.tenue, { width: 40, fontSize: 14 }]}>{diaCorto(f)}</Text>
              <View style={{ flex: 1 }}>
                {delDia.length === 0 && <Text style={letra.tenue}>sin apuntar</Text>}
                {delDia.map((m) => (
                  <Text key={m.id} style={letra.cuerpo}>
                    {[m.comida, m.cena, m.fruta].filter(Boolean).join(' · ') || m.notas || '—'}
                    <Text style={letra.tenue}>
                      {'  en casa de ' + (personas.find((p) => p.id === m.casa_persona_id)?.nombre.toLowerCase() ?? '?')}
                    </Text>
                  </Text>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

// ── colegio ───────────────────────────────────────────────────────────

function Colegio({ nino, abrir, alGuardar }: {
  nino: Nino;
  abrir: (f: AbrirFicha) => void;
  alGuardar: (d: Deshacer, texto: string) => void;
}) {
  const { horarioLectivo, extraescolares, horarioCentro, config } = useSesion();
  const { subir } = useCola();
  const hoy = hoyMadrid();
  const domingo = semanaDe(hoy)[6];
  const curso = config.curso_escolar;

  const clases = horarioLectivo.filter((c) =>
    c.nino_id === nino.id && (!curso || !c.curso_escolar || c.curso_escolar === curso));
  const extras = extraescolares.filter((e) =>
    e.nino_id === nino.id && (!e.fecha_hasta || e.fecha_hasta >= hoy));
  const centro = horarioCentro.find((h) => h.nino_id === nino.id);
  const { franjas, clasesDe } = tablaHorario(clases);

  const tareas = useFilas<Tarea>('tareas', { desde: sumarDias(hoy, -60), hasta: sumarDias(hoy, 180), nino: nino.id });
  const lecturas = useFilas<Lectura>('lecturas', { desde: sumarDias(hoy, -365), hasta: hoy, nino: nino.id });
  const eventos = useFilas<EventoEscolar>('eventos', { desde: hoy, hasta: sumarDias(hoy, 90), nino: nino.id });

  // Con lo de la cola mezclado: lo que se acaba de apuntar se ve ya, aunque
  // todavía no haya subido.
  const susTareas = conPendientes<Tarea>('tareas', tareas.filas, (t) => t.nino_id === nino.id)
    .filter((t) => t.nino_id === nino.id);
  const susEventos = conPendientes<EventoEscolar>('eventos', eventos.filas, (e) => !e.nino_id || e.nino_id === nino.id)
    .filter((e) => !e.nino_id || e.nino_id === nino.id);

  const grupos = agruparTareas(susTareas, hoy, domingo);
  const sinTareas = !Object.values(grupos).some((g) => g.length);
  const suyasLecturas = conPendientes<Lectura>('lecturas', lecturas.filas, (l) => l.nino_id === nino.id)
    .filter((l) => l.nino_id === nino.id);

  /** Un toque en la casilla: hecha o pendiente otra vez. */
  function alternar(t: Tarea) {
    const antes = valoresDe('tareas', t);
    const ahora = conEstado('tareas', antes, hecha(t) ? 'pendiente' : 'hecha', ahoraMadrid().marca);
    const d = editarFicha('tareas', t.id, antes, cambiosFicha(antes, ahora));
    if (!d) return;
    subir();
    alGuardar(d, `${t.titulo} · ${hecha(t) ? 'otra vez pendiente' : 'hecha'}`);
  }
  const leyendo = suyasLecturas.filter((l) => !l.fecha_fin);
  const leidas = suyasLecturas.filter((l) => l.fecha_fin).sort((a, b) => (b.fecha_fin ?? '').localeCompare(a.fecha_fin ?? '')).slice(0, 3);

  return (
    <>
      <Seccion titulo="HORARIO">
        {clases.length === 0 ? (
          <Text style={letra.tenue}>El horario de clases todavía no está en la hoja (pestaña horario_lectivo).</Text>
        ) : (
          <View>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ width: 44 }} />
              {DIAS_LECTIVOS.map((d) => (
                <Text key={d} style={[letra.tenue, { flex: 1, textAlign: 'center', fontSize: 12 }]}>{NOMBRE_DIA[d]}</Text>
              ))}
            </View>
            {franjas.map((fr) => (
              <View key={fr.clave} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: color.borde, paddingVertical: 4 }}>
                <Text style={[letra.tenue, { width: 44, fontSize: 11 }]}>{fr.hora.replace('–', '\n')}</Text>
                {DIAS_LECTIVOS.map((d) => (
                  <View key={d} style={{ flex: 1, paddingHorizontal: 2 }}>
                    {clasesDe(fr.clave, d).map((c) => (
                      <View key={c.id}>
                        <Text style={{ fontSize: 11, color: color.texto }} numberOfLines={3} android_hyphenationFrequency="full">{c.asignatura}</Text>
                        {!!c.equipamiento && <Etiqueta texto={nombreEquipamiento(c.equipamiento)} />}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
        {extras.length > 0 && (
          <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: color.borde, paddingTop: 4, marginTop: clases.length ? 0 : espacio.s }}>
            <Text style={[letra.tenue, { width: 44, fontSize: 11 }]}>Extra</Text>
            {DIAS_LECTIVOS.map((d) => (
              <View key={d} style={{ flex: 1, paddingHorizontal: 2 }}>
                {extras.filter((e) => Number(e.dia_semana) === d).map((e) => (
                  <View key={e.id}>
                    <Text style={{ fontSize: 11, color: nino.color_hex, fontWeight: '600' }} numberOfLines={3} android_hyphenationFrequency="full">{e.actividad}</Text>
                    <Text style={[letra.tenue, { fontSize: 11 }]}>
                      {e.hora_fin}{e.fecha_desde && e.fecha_desde > hoy ? `\ndesde ${fechaCorta(e.fecha_desde).slice(0, 5)}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
        {centro && (
          <Text style={[letra.tenue, { marginTop: espacio.s }]}>
            Entrada {[centro.entrada_desde, centro.entrada_hasta].filter(Boolean).join('–')} · salida{' '}
            {[centro.salida_desde, centro.salida_hasta].filter(Boolean).join('–')}
            {centro.puerta ? ` · puerta de ${centro.puerta}` : ''}
          </Text>
        )}
      </Seccion>

      <Seccion titulo="TAREAS" alAnadir={() => abrir({ tabla: 'tareas', nino_id: nino.id })}>
        {sinTareas && <Text style={letra.tenue}>Sin tareas apuntadas.</Text>}
        {([
          ['Atrasadas', grupos.atrasadas, color.error],
          ['Vence hoy', grupos.hoy, undefined],
          ['Esta semana', grupos.semana, undefined],
          ['Más adelante', grupos.despues, undefined],
          ['Hechas', grupos.hechas.slice(0, 5), color.textoTenue],
        ] as [string, Tarea[], string | undefined][]).map(([titulo, lista, tono]) => (
          <GrupoTareas
            key={titulo}
            titulo={titulo}
            tareas={lista}
            tono={tono}
            alAbrir={(t) => abrir({ tabla: 'tareas', fila: t, nino_id: nino.id })}
            alAlternar={alternar}
          />
        ))}
      </Seccion>

      <Seccion titulo="LECTURAS" alAnadir={() => abrir({ tabla: 'lecturas', nino_id: nino.id })}>
        {suyasLecturas.length === 0 && <Text style={letra.tenue}>Sin lecturas apuntadas.</Text>}
        {[...leyendo, ...leidas].map((l) => (
          <Pressable
            key={l.id}
            onPress={() => abrir({ tabla: 'lecturas', fila: l, nino_id: nino.id })}
            style={{ paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: espacio.s }}
          >
            <View style={{ flex: 1 }}>
            <Text style={letra.cuerpo}>
              {l.titulo}{l.autor ? <Text style={letra.tenue}>{'  ' + l.autor}</Text> : null}
            </Text>
            <Text style={letra.tenue}>
              {l.fecha_fin ? `Leído el ${fechaCorta(l.fecha_fin)}` : 'Leyendo ahora'}
              {l.paginas_leidas ? ` · ${l.paginas_leidas}${l.paginas_totales ? ` de ${l.paginas_totales}` : ''} páginas` : ''}
              {l.valoracion ? ` · ${'★'.repeat(Math.max(0, Math.min(5, Number(l.valoracion))))}` : ''}
            </Text>
            </View>
            {l.pendiente && <Punto />}
          </Pressable>
        ))}
      </Seccion>

      <Seccion titulo="EVENTOS PRÓXIMOS" alAnadir={() => abrir({ tabla: 'eventos', nino_id: nino.id })}>
        {susEventos.length === 0 && <Text style={letra.tenue}>Nada en los próximos tres meses.</Text>}
        {susEventos.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => abrir({ tabla: 'eventos', fila: e, nino_id: nino.id })}
            style={{ paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: espacio.s }}
          >
            <View style={{ flex: 1 }}>
              <Text style={letra.cuerpo}>{e.titulo}</Text>
              <Text style={letra.tenue}>
                {diaYNumero(e.fecha_inicio)}{e.fecha_fin && e.fecha_fin !== e.fecha_inicio ? ` al ${diaYNumero(e.fecha_fin)}` : ''}
                {e.hora_inicio ? ` · ${e.hora_inicio}` : ''}
                {e.lugar ? ` · ${e.lugar}` : ''}{e.notas ? ` · ${e.notas}` : ''}
              </Text>
            </View>
            {e.pendiente && <Punto />}
          </Pressable>
        ))}
      </Seccion>
    </>
  );
}

function GrupoTareas({ titulo, tareas, tono, alAbrir, alAlternar }: {
  titulo: string;
  tareas: (Tarea & { pendiente?: boolean })[];
  tono?: string;
  alAbrir: (t: Tarea) => void;
  alAlternar: (t: Tarea) => void;
}) {
  if (!tareas.length) return null;
  return (
    <View style={{ marginBottom: espacio.s }}>
      <Text style={[letra.suave, { fontWeight: '600', color: tono ?? color.textoSuave }]}>{titulo}</Text>
      {tareas.map((t) => {
        const marcada = hecha(t);
        return (
          <Pressable
            key={t.id}
            onPress={() => alAbrir(t)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, paddingVertical: 3 }}
          >
            {/* Un toque aquí la da por hecha; en el resto de la línea, se corrige. */}
            <Pressable
              onPress={() => alAlternar(t)}
              hitSlop={10}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: marcada }}
              accessibilityLabel={`${t.titulo}: ${marcada ? 'hecha' : 'pendiente'}`}
              style={{
                width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
                borderColor: marcada ? color.acento : color.borde,
                backgroundColor: marcada ? color.acento : 'transparent',
              }}
            >
              {marcada && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
            </Pressable>
            <Text style={[letra.cuerpo, { flex: 1, textDecorationLine: marcada ? 'line-through' : 'none' }]}>
              {t.titulo}{t.asignatura ? <Text style={letra.tenue}>{'  ' + t.asignatura}</Text> : null}
            </Text>
            {t.pendiente && <Punto />}
            <Text style={letra.tenue}>{diaCorto(t.fecha_entrega)} {Number(t.fecha_entrega.slice(8))}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Guardado en el móvil, pendiente de subir. */
function Punto() {
  return (
    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color.pendiente }} />
  );
}

// ── salud ─────────────────────────────────────────────────────────────

function Salud({ nino, abrir }: { nino: Nino; abrir: (f: AbrirFicha) => void }) {
  const hoy = hoyMadrid();
  // Una medida o una consulta se pueden apuntar con fecha de mañana (la cita
  // que ya está puesta), así que el rango llega un poco más allá de hoy.
  const eventos = useFilas<SaludEvento>('salud_eventos', { desde: sumarDias(hoy, -730), hasta: sumarDias(hoy, 90), nino: nino.id });
  const medidas = useFilas<SaludMedida>('salud_medidas', { desde: sumarDias(hoy, -3650), hasta: sumarDias(hoy, 90), nino: nino.id });

  const suyos = conPendientes<SaludEvento>('salud_eventos', eventos.filas, (e) => e.nino_id === nino.id)
    .filter((e) => e.nino_id === nino.id);
  const activos = tratamientosActivos(suyos, hoy);
  const historial = [...suyos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const susMedidas = conPendientes<SaludMedida>('salud_medidas', medidas.filas, (m) => m.nino_id === nino.id)
    .filter((m) => m.nino_id === nino.id)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <>
      {activos.length > 0 && (
        <Seccion titulo="TRATAMIENTOS ACTIVOS">
          {activos.map(({ evento, quedan }) => (
            <Pressable
              key={evento.id}
              onPress={() => abrir({ tabla: 'salud_eventos', fila: evento, nino_id: nino.id })}
              style={{ paddingVertical: 3 }}
            >
              <Text style={[letra.cuerpo, { fontWeight: '600' }]}>{evento.titulo}</Text>
              {!!evento.tratamiento && <Text style={letra.suave}>{evento.tratamiento}</Text>}
              <Text style={[letra.tenue, { color: color.aviso }]}>
                {quedan === null ? 'Sin fecha de fin' : quedan === 0 ? 'Último día hoy' : `Quedan ${quedan} ${quedan === 1 ? 'día' : 'días'}`}
              </Text>
            </Pressable>
          ))}
        </Seccion>
      )}

      <Seccion titulo="HISTORIAL" alAnadir={() => abrir({ tabla: 'salud_eventos', nino_id: nino.id })}>
        {historial.length === 0 && <Text style={letra.tenue}>Nada apuntado en los dos últimos años.</Text>}
        {historial.map((e) => (
          <Pressable
            key={e.id}
            onPress={() => abrir({ tabla: 'salud_eventos', fila: e, nino_id: nino.id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: espacio.xs }}
          >
            <Text style={[letra.tenue, { width: 78 }]}>{fechaCorta(e.fecha)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={letra.cuerpo}>
                {e.titulo}<Text style={letra.tenue}>{'  ' + (ETIQUETA_SALUD[e.tipo] ?? e.tipo)}</Text>
              </Text>
              {!!(e.profesional || e.centro) && (
                <Text style={letra.tenue}>{[e.profesional, e.centro].filter(Boolean).join(' · ')}</Text>
              )}
              {!!e.diagnostico && <Text style={letra.suave}>{e.diagnostico}</Text>}
            </View>
            {e.pendiente && <Punto />}
          </Pressable>
        ))}
      </Seccion>

      <Seccion titulo="PESO Y TALLA" alAnadir={() => abrir({ tabla: 'salud_medidas', nino_id: nino.id })}>
        {susMedidas.length === 0 && <Text style={letra.tenue}>Sin medidas apuntadas.</Text>}
        {susMedidas.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => abrir({ tabla: 'salud_medidas', fila: m, nino_id: nino.id })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.m, paddingVertical: 2 }}
          >
            <Text style={[letra.tenue, { width: 78 }]}>{fechaCorta(m.fecha)}</Text>
            <Text style={[letra.cuerpo, { flex: 1 }]}>
              {[m.peso_kg ? `${m.peso_kg} kg` : '', m.talla_cm ? `${m.talla_cm} cm` : ''].filter(Boolean).join(' · ') || '—'}
            </Text>
            {m.pendiente && <Punto />}
          </Pressable>
        ))}
      </Seccion>
    </>
  );
}

// ── piezas ────────────────────────────────────────────────────────────

const tarjeta = {
  backgroundColor: color.tarjeta, borderRadius: radio.m,
  borderWidth: 1, borderColor: color.borde, padding: espacio.m,
};

function Seccion({ titulo, alAnadir, children }: {
  titulo: string; alAnadir?: () => void; children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: espacio.xl }}>
      <View style={{
        flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: espacio.s,
      }}>
        <Text style={letra.seccion}>{titulo}</Text>
        {alAnadir && (
          <Pressable onPress={alAnadir} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Añadir en ${titulo.toLowerCase()}`}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: color.acento }}>+ Añadir</Text>
          </Pressable>
        )}
      </View>
      <View style={tarjeta}>{children}</View>
    </View>
  );
}

function Etiqueta({ texto }: { texto: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: '#E6EFE5', borderRadius: 6, paddingHorizontal: 4, marginTop: 2 }}>
      <Text style={{ fontSize: 10, color: color.acento }}>{texto}</Text>
    </View>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <View style={{ backgroundColor: '#FEF3C7', borderRadius: radio.m, padding: espacio.m, marginTop: espacio.s }}>
      <Text style={{ color: color.aviso, fontSize: 14 }}>{texto}</Text>
    </View>
  );
}
