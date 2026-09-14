/**
 * CALENDARIO — el mes con la custodia de fondo.
 *
 * La pregunta que se hace uno mirándolo es "¿quién los tiene?", así que el
 * fondo de cada día lleva el color del progenitor (pestaña 'personas'), no el
 * del niño. Esa capa no se apaga. Encima, capas que sí se encienden y apagan:
 * colegio, tareas y entregas, eventos y salud.
 *
 * Deslizar a los lados cambia de mes (o de semana); hacia arriba, pasa a la
 * semana del día elegido; hacia abajo, vuelve al mes. Tocar un día enseña su
 * resumen debajo, y tocar el resumen abre ese día en la misma pantalla que Hoy.
 *
 * La custodia la calcula el backend (acción 'custodia'), no la app.
 */

import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, PanResponder, StatusBar, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSesion } from '../../src/estado/sesion';
import { useFilas, useLectura } from '../../src/estado/lectura';
import { custodia as pedirCustodia } from '../../src/api/cliente';
import { recordar, recuperar } from '../../src/db/cache';
import type {
  Custodia, DiaEscolar, EventoEscolar, NinoId, RespuestaCustodia, SaludEvento, Tarea,
} from '../../src/domain/tipos';
import {
  CITAS_SALUD, NO_LECTIVOS, eventoEnDia, lunesDe, mesDe, nombreMes, quienesTienen,
  rangoRejilla, recuentoMes, rejillaMes, semanaDe, sumarMeses,
} from '../../src/domain/calendario';
import { diaYNumero, hoyMadrid, letraDia, sumarDias } from '../../src/domain/fechas';
import { color, espacio, letra, radio, tintar } from '../../src/ui/tema';

type Capa = 'colegio' | 'tareas' | 'eventos' | 'salud';
type Capas = Record<Capa, boolean>;

const CAPAS: { clave: Capa; texto: string }[] = [
  { clave: 'colegio', texto: 'Colegio' },
  { clave: 'tareas', texto: 'Tareas' },
  { clave: 'eventos', texto: 'Eventos' },
  { clave: 'salud', texto: 'Salud' },
];
const CAPAS_INICIALES: Capas = { colegio: true, tareas: true, eventos: false, salud: false };
const CLAVE_CAPAS = 'calendario:capas';
const LETRAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Algo de una capa en un día: un punto en la rejilla, una línea en el resumen. */
interface Marca { clave: string; tono: string; texto: string }

export default function Calendario() {
  const { credenciales, ninos } = useSesion();
  const hoy = hoyMadrid();
  const [mes, setMes] = useState(() => mesDe(hoy));
  const [elegido, setElegido] = useState(hoy);
  const [vista, setVista] = useState<'mes' | 'semana'>('mes');
  const [capas, setCapas] = useState<Capas>(() => ({
    ...CAPAS_INICIALES, ...(recuperar<Partial<Capas>>(CLAVE_CAPAS) ?? {}),
  }));

  // Siempre la rejilla entera del mes: la semana elegida cae dentro.
  const { desde, hasta } = rangoRejilla(mes);
  const lecturaCustodia = useLectura<RespuestaCustodia>(
    credenciales ? `custodia:${desde}:${hasta}` : null,
    () => pedirCustodia(credenciales!, desde, hasta),
  );
  const dias = lecturaCustodia.datos?.dias ?? {};
  const escolar = useFilas<DiaEscolar>('calendario_escolar', { desde, hasta }, capas.colegio);
  const tareas = useFilas<Tarea>('tareas', { desde, hasta }, capas.tareas);
  // Un evento de varios días puede empezar antes del mes.
  const eventos = useFilas<EventoEscolar>('eventos', { desde: sumarDias(desde, -31), hasta }, capas.eventos);
  const salud = useFilas<SaludEvento>('salud_eventos', { desde, hasta }, capas.salud);

  const nino = (id?: string) => ninos.find((n) => n.id === id);

  function noLectivo(fecha: string) {
    if (!capas.colegio) return null;
    return escolar.filas.find((f) => f.fecha === fecha && NO_LECTIVOS.includes(f.tipo)) ?? null;
  }

  function marcasDe(fecha: string): Marca[] {
    const marcas: Marca[] = [];
    const conNombre = (nino_id: string | undefined, texto: string) =>
      [nino(nino_id)?.nombre, texto].filter(Boolean).join(' · ');
    if (capas.colegio) {
      escolar.filas.filter((f) => f.fecha === fecha && !NO_LECTIVOS.includes(f.tipo)).forEach((f) =>
        marcas.push({
          clave: f.id, tono: color.aviso,
          texto: f.descripcion || (f.tipo === 'jornada_reducida' ? 'Jornada reducida' : 'Evento del colegio'),
        }));
    }
    if (capas.tareas) {
      tareas.filas.filter((t) => t.fecha_entrega === fecha).forEach((t) =>
        marcas.push({ clave: t.id, tono: nino(t.nino_id)?.color_hex ?? color.texto, texto: conNombre(t.nino_id, t.titulo) }));
    }
    if (capas.eventos) {
      eventos.filas.filter((e) => eventoEnDia(e, fecha)).forEach((e) =>
        marcas.push({ clave: e.id, tono: nino(e.nino_id)?.color_hex ?? color.texto, texto: conNombre(e.nino_id, e.titulo) }));
    }
    if (capas.salud) {
      salud.filas.filter((s) => s.fecha === fecha && CITAS_SALUD.includes(s.tipo)).forEach((s) =>
        marcas.push({ clave: s.id, tono: color.error, texto: conNombre(s.nino_id, s.titulo) }));
    }
    return marcas;
  }

  function textoCustodia(dia?: Record<NinoId, Custodia>) {
    const quienes = quienesTienen(dia);
    if (!quienes.length) return lecturaCustodia.datos ? 'Sin custodia en el calendario' : 'Custodia sin cargar';
    if (quienes.length === 1) return `Con ${quienes[0].nombre.toLowerCase()}`;
    return Object.entries(dia!).map(([id, c]) => `${nino(id)?.nombre ?? id} con ${c.nombre.toLowerCase()}`).join(' · ');
  }

  // ── moverse ─────────────────────────────────────────────────────────

  function irA(fecha: string, enVista = vista) {
    setElegido(fecha);
    setMes(mesDe(enVista === 'semana' ? lunesDe(fecha) : fecha));
  }

  function mover(pasos: number) {
    if (vista === 'semana') {
      irA(sumarDias(elegido, 7 * pasos));
      return;
    }
    const nuevo = sumarMeses(mes, pasos);
    setMes(nuevo);
    setElegido(mesDe(hoy) === nuevo ? hoy : `${nuevo}-01`);
  }

  function cambiarVista(nueva: 'mes' | 'semana') {
    setVista(nueva);
    irA(elegido, nueva);
  }

  function alternar(capa: Capa) {
    const nuevas = { ...capas, [capa]: !capas[capa] };
    setCapas(nuevas);
    recordar(CLAVE_CAPAS, nuevas);
  }

  const abrirDia = (fecha: string) => router.push(`/dia/${fecha}`);

  // El gesto lee siempre lo último: se crea una vez y las acciones cambian.
  const acciones = useRef({ mover, cambiarVista, vista });
  acciones.current = { mover, cambiarVista, vista };
  const gesto = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 || Math.abs(g.dy) > 24,
    onPanResponderRelease: (_, g) => {
      const a = acciones.current;
      if (Math.abs(g.dx) > Math.abs(g.dy)) {
        if (Math.abs(g.dx) > 50) a.mover(g.dx < 0 ? 1 : -1);
      } else if (g.dy < -50 && a.vista === 'mes') {
        a.cambiarVista('semana');
      } else if (g.dy > 50 && a.vista === 'semana') {
        a.cambiarVista('mes');
      }
    },
  })).current;

  // ── pintar ──────────────────────────────────────────────────────────

  const semana = semanaDe(elegido);
  const recuento = recuentoMes(dias, mes).map((r) => `${r.nombre.toLowerCase()} ${r.dias}`).join(' · ');
  const conAnio = mes.slice(0, 4) !== hoy.slice(0, 4) ? ` ${mes.slice(0, 4)}` : '';
  const seVeHoy = vista === 'mes' ? rejillaMes(mes).some((s) => s.includes(hoy)) : semana.includes(hoy);
  const avisoCustodia = lecturaCustodia.datos ? null
    : lecturaCustodia.estado === 'sin_red' ? 'Sin conexión: la custodia de este mes todavía no está guardada en el móvil.'
    : lecturaCustodia.estado === 'lento' ? 'El backend tarda en responder. Se reintenta solo.'
    : lecturaCustodia.estado === 'error' ? lecturaCustodia.mensaje
    : null;
  const elegidoNoLectivo = noLectivo(elegido);

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo, paddingTop: (StatusBar.currentHeight ?? 24) + espacio.l }}>
      <View style={{ paddingHorizontal: espacio.l }}>
        {/* Mes y recuento */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
          <Pressable onPress={() => mover(-1)} hitSlop={12} accessibilityLabel="Anterior">
            <Text style={{ fontSize: 26, color: color.textoSuave }}>‹</Text>
          </Pressable>
          <Text style={[letra.titulo, { flexShrink: 1 }]}>{nombreMes(mes)}{conAnio}</Text>
          <Pressable onPress={() => mover(1)} hitSlop={12} accessibilityLabel="Siguiente">
            <Text style={{ fontSize: 26, color: color.textoSuave }}>›</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={[letra.suave, { fontSize: 13 }]}>{recuento}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 18 }}>
          <Text style={letra.tenue}>
            {vista === 'semana'
              ? `Semana del ${Number(semana[0].slice(8))} al ${Number(semana[6].slice(8))}`
              : 'Desliza hacia arriba para ver la semana'}
          </Text>
          {!seVeHoy && (
            <Pressable onPress={() => irA(hoy)} hitSlop={8}>
              <Text style={[letra.tenue, { color: color.acento, fontWeight: '600' }]}>Volver a hoy</Text>
            </Pressable>
          )}
        </View>

        {/* Capas: la custodia siempre encendida */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: espacio.s, paddingVertical: espacio.m }}
        >
          <Chip texto="Custodia" activo />
          {CAPAS.map((c) => (
            <Chip key={c.clave} texto={c.texto} activo={capas[c.clave]} alTocar={() => alternar(c.clave)} />
          ))}
        </ScrollView>

        {avisoCustodia && (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: radio.m, padding: espacio.m, marginBottom: espacio.s }}>
            <Text style={{ color: color.aviso, fontSize: 14 }}>{avisoCustodia}</Text>
          </View>
        )}

        <View {...gesto.panHandlers}>
          {vista === 'mes' ? (
            <>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {LETRAS.map((l) => (
                  <Text key={l} style={[letra.tenue, { flex: 1, textAlign: 'center', fontSize: 12 }]}>{l}</Text>
                ))}
              </View>
              {rejillaMes(mes).map((s) => (
                <View key={s[0]} style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  {s.map((f) => (
                    <Celda
                      key={f}
                      fecha={f}
                      fuera={mesDe(f) !== mes}
                      custodia={dias[f]}
                      apagado={!!noLectivo(f)}
                      marcas={mesDe(f) === mes ? marcasDe(f) : []}
                      elegido={f === elegido}
                      esHoy={f === hoy}
                      alTocar={() => irA(f)}
                    />
                  ))}
                </View>
              ))}
            </>
          ) : (
            semana.map((f) => (
              <FilaSemana
                key={f}
                fecha={f}
                custodia={dias[f]}
                textoCustodia={textoCustodia(dias[f])}
                noLectivo={noLectivo(f)}
                marcas={marcasDe(f)}
                esHoy={f === hoy}
                alTocar={() => abrirDia(f)}
              />
            ))
          )}
        </View>
      </View>

      {/* Resumen del día elegido: tocarlo abre el día entero */}
      {vista === 'mes' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: espacio.l, paddingBottom: espacio.xl }}>
          <Text style={[letra.seccion, { marginBottom: espacio.s }]}>{diaYNumero(elegido).toUpperCase()}</Text>
          <Pressable
            onPress={() => abrirDia(elegido)}
            accessibilityRole="button"
            style={{
              backgroundColor: color.tarjeta, borderRadius: radio.m,
              borderWidth: 1, borderColor: color.borde, padding: espacio.m,
            }}
          >
            <Text style={letra.dato}>{textoCustodia(dias[elegido])}</Text>
            {elegidoNoLectivo && (
              <Text style={letra.suave}>
                {elegidoNoLectivo.descripcion || elegidoNoLectivo.tipo.replace('_', ' ')}
              </Text>
            )}
            {marcasDe(elegido).map((m) => <LineaMarca key={m.clave} marca={m} />)}
            <Text style={[letra.tenue, { marginTop: espacio.s }]}>Ver el día ›</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

// ── piezas ────────────────────────────────────────────────────────────

function Chip({ texto, activo, alTocar }: { texto: string; activo: boolean; alTocar?: () => void }) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={!alTocar}
      accessibilityRole="switch"
      accessibilityState={{ checked: activo }}
      style={{
        paddingHorizontal: espacio.m, paddingVertical: espacio.xs + 2, borderRadius: 20,
        backgroundColor: activo ? color.texto : color.tarjeta,
        borderWidth: 1, borderColor: activo ? color.texto : color.borde,
      }}
    >
      <Text style={{ fontSize: 13, color: activo ? '#fff' : color.textoSuave }}>{texto}</Text>
    </Pressable>
  );
}

/** Un día del mes: el fondo es de quien los tiene; partido en dos si están repartidos. */
function Celda({ fecha, fuera, custodia, apagado, marcas, elegido, esHoy, alTocar }: {
  fecha: string;
  fuera: boolean;
  custodia?: Record<NinoId, Custodia>;
  apagado: boolean;
  marcas: Marca[];
  elegido: boolean;
  esHoy: boolean;
  alTocar: () => void;
}) {
  const quienes = fuera ? [] : quienesTienen(custodia);
  return (
    <Pressable
      onPress={alTocar}
      accessibilityLabel={diaYNumero(fecha)}
      style={{
        flex: 1, height: 50, borderRadius: radio.s, overflow: 'hidden',
        borderWidth: 2, borderColor: elegido ? color.texto : 'transparent',
      }}
    >
      {quienes.length > 0 && (
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {quienes.map((q) => (
            // Un día sin cole se apaga, pero sigue diciendo quién los tiene.
            <View key={q.persona_id} style={{ flex: 1, backgroundColor: tintar(q.color_hex, apagado ? 0.1 : 0.22) }} />
          ))}
        </View>
      )}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{
          fontSize: 16,
          fontWeight: esHoy ? '800' : '500',
          textDecorationLine: esHoy ? 'underline' : 'none',
          color: fuera || apagado ? color.textoTenue : color.texto,
        }}>
          {Number(fecha.slice(8))}
        </Text>
        <View style={{ flexDirection: 'row', gap: 3, height: 6, marginTop: 2 }}>
          {marcas.slice(0, 3).map((m) => (
            <View key={m.clave} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: m.tono }} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}

/** Un día de la semana, con todo lo suyo a la vista. Tocarlo abre el día. */
function FilaSemana({ fecha, custodia, textoCustodia, noLectivo, marcas, esHoy, alTocar }: {
  fecha: string;
  custodia?: Record<NinoId, Custodia>;
  textoCustodia: string;
  noLectivo: DiaEscolar | null;
  marcas: Marca[];
  esHoy: boolean;
  alTocar: () => void;
}) {
  const quienes = quienesTienen(custodia);
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      style={{
        flexDirection: 'row', alignItems: 'stretch', marginTop: espacio.s, minHeight: 58,
        backgroundColor: color.tarjeta, borderRadius: radio.m, overflow: 'hidden',
        borderWidth: esHoy ? 2 : 1, borderColor: esHoy ? color.texto : color.borde,
      }}
    >
      <View style={{ width: 52, flexDirection: 'row' }}>
        {(quienes.length ? quienes : [null]).map((q, i) => (
          <View key={q?.persona_id ?? i} style={{ flex: 1, backgroundColor: q ? tintar(q.color_hex, noLectivo ? 0.1 : 0.22) : '#EFEEEA' }} />
        ))}
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={[letra.tenue, { fontSize: 12 }]}>{letraDia(fecha)}</Text>
          <Text style={[letra.dato, { color: noLectivo ? color.textoTenue : color.texto }]}>{Number(fecha.slice(8))}</Text>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: espacio.m, paddingVertical: espacio.xs, justifyContent: 'center' }}>
        <Text style={letra.cuerpo} numberOfLines={1}>{textoCustodia}</Text>
        {noLectivo && <Text style={letra.tenue} numberOfLines={1}>{noLectivo.descripcion || noLectivo.tipo.replace('_', ' ')}</Text>}
        {marcas.slice(0, 2).map((m) => <LineaMarca key={m.clave} marca={m} />)}
        {marcas.length > 2 && <Text style={letra.tenue}>y {marcas.length - 2} más</Text>}
      </View>
      <Text style={[letra.suave, { alignSelf: 'center', paddingRight: espacio.m, fontSize: 18 }]}>›</Text>
    </Pressable>
  );
}

function LineaMarca({ marca }: { marca: Marca }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: marca.tono }} />
      <Text style={[letra.suave, { flexShrink: 1 }]} numberOfLines={1}>{marca.texto}</Text>
    </View>
  );
}
