/**
 * UN DÍA — la pantalla "Hoy", para hoy o para cualquier fecha.
 *
 * Es la misma pantalla en los dos sitios, a propósito: Hoy es este componente
 * sin fecha, y Calendario abre aquí el día que se toca. Responde sin
 * desplazarse a "¿qué pasa ese día?": quién los tiene, qué se ha apuntado, a
 * qué hora y por dónde se recogen, qué hay que preparar para el día siguiente,
 * comedor, entregas y medicación.
 *
 * El orden no es casual. Lo apuntado va justo debajo de quién los tiene: sus
 * iconos son el camino de dos toques (icono y sí/no) y tienen que verse al
 * abrir. Después, lo que se consulta con prisa y de pie en la puerta del cole.
 * Lo menos frecuente va por "+ Apuntar".
 *
 * Se apunta hoy y en días pasados (lo que se olvidó apuntar); en días futuros
 * no, porque todavía no ha pasado.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Pressable, Image, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { useSesion } from '../../estado/sesion';
import { useCola } from '../../estado/cola';
import { useLectura } from '../../estado/lectura';
import { useMenusComedor } from '../../estado/menus';
import { nombreMes } from '../../domain/calendario';
import { nombreEquipamiento } from '../../domain/ninos';
import { agenda } from '../../api/cliente';
import type { MenuCasa, NinoDelDia, RegistroNino, RegistroTipo, RespuestaAgenda } from '../../domain/tipos';
import { TIPOS_RESUMEN, definicion, ultimoApunte } from '../../domain/apuntes';
import { diaCorto, diaYNumero, hoyMadrid, sumarDias } from '../../domain/fechas';
import { conPendientes, olvidarConfirmadas, type ConMarca } from '../../db/cola';
import { guardarFilas, leerFilas, recordar, recuperar } from '../../db/cache';
import { deshacer, type Deshacer } from '../../db/apuntar';
import HojaApuntar, { type InicioApuntar } from '../apuntar/HojaApuntar';
import AvisoDeshacer from '../AvisoDeshacer';
import { color, espacio, letra, radio, fechaLarga } from '../tema';

const PORTADA = require('../../../assets/diseno/portada.png');
/** El color de arriba de la ilustración, para que siga bajo la barra de estado. */
const CIELO = '#FBEEDD';
/** La última agenda de hoy recibida: lo que se pinta si falta la de hoy (primer arranque del día sin red). */
const CLAVE_ULTIMA_AGENDA = 'agenda:ultima';

const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function PantallaDia({ fecha: fechaPedida, conVolver }: {
  /** Sin fecha: hoy, que cambia solo a medianoche. */
  fecha?: string;
  /** Abierta desde Calendario o Niños: con vuelta atrás en vez de la ilustración. */
  conVolver?: boolean;
}) {
  const { credenciales, avisoEsquema } = useSesion();
  const { pendientes, subir } = useCola();
  const hoy = hoyMadrid();
  const fecha = fechaPedida ?? hoy;
  const esHoy = fecha === hoy;
  const puedeApuntar = fecha <= hoy;
  const [refrescando, setRefrescando] = useState(false);
  const [hoja, setHoja] = useState<InicioApuntar | null>(null);
  const [aviso, setAviso] = useState<{ d: Deshacer; texto: string; clave: number } | null>(null);

  // Se pinta con lo guardado en el móvil y se refresca por detrás.
  const lectura = useLectura<RespuestaAgenda>(
    credenciales ? `agenda:${fecha}` : null,
    () => agenda(credenciales!, fecha),
    {
      alRecibir: (a, pedidoEn) => {
        if (a.fecha === hoyMadrid()) recordar(CLAVE_ULTIMA_AGENDA, a);
        guardarFilas('registro_nino', { desde: a.fecha, hasta: a.fecha }, a.registro);
        guardarFilas('menu_casa', { desde: a.fecha, hasta: a.fecha }, a.menu_casa);
        olvidarConfirmadas(pedidoEn);
      },
    },
  );
  const { refrescar, estado } = lectura;
  const { meses: mesesConMenu } = useMenusComedor();
  const mesDelDia = fecha.slice(0, 7);
  const datos = useMemo(
    () => lectura.datos ?? (esHoy ? recuperar<RespuestaAgenda>(CLAVE_ULTIMA_AGENDA) : null),
    [lectura.datos, esHoy],
  );

  // Cuando la cola sube algo, se vuelve a leer para que la agenda lo traiga.
  const pendientesAntes = useRef(pendientes);
  useEffect(() => {
    if (pendientes < pendientesAntes.current) refrescar();
    pendientesAntes.current = pendientes;
  }, [pendientes, refrescar]);

  const cerrarAviso = useCallback(() => setAviso(null), []);

  async function tirarParaRefrescar() {
    setRefrescando(true);
    subir();
    await refrescar();
    setRefrescando(false);
  }

  function volver() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  if (!datos && estado === 'cargando') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: color.fondo }}>
        <ActivityIndicator color={color.acento} />
      </View>
    );
  }

  const deOtraFecha = !!datos && datos.fecha !== fecha;
  // Lo apuntado ese día: de su agenda; si no la hay, de lo guardado en el móvil.
  const rango = { desde: fecha, hasta: fecha };
  const registro = conPendientes(
    'registro_nino',
    datos && !deOtraFecha ? datos.registro : leerFilas<RegistroNino>('registro_nino', rango),
    (r) => r.fecha === fecha,
  );
  const menus = conPendientes(
    'menu_casa',
    datos && !deOtraFecha ? datos.menu_casa : leerFilas<MenuCasa>('menu_casa', rango),
    (m) => m.fecha === fecha,
  );
  const avisoLectura = deOtraFecha && datos
    ? (estado === 'cargando'
      ? `Actualizando: lo que ves es del ${fechaLarga(datos.fecha)}.`
      : `Sin la agenda de hoy: lo que ves es del ${fechaLarga(datos.fecha)}. Lo que apuntes se guarda y sube solo.`)
    : estado === 'sin_red'
      ? (datos ? 'Sin conexión. Lo que apuntes se guarda en el móvil y sube solo.'
        : 'Sin conexión, y este día todavía no está guardado en el móvil.')
    : estado === 'lento' ? 'El backend tarda en responder: ves lo último que se supo y se reintenta solo.'
    : null;
  const diaSiguiente = esHoy ? 'MAÑANA' : `EL ${diaYNumero(sumarDias(fecha, 1)).toUpperCase()}`;

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={tirarParaRefrescar} />
        }
      >
        {conVolver ? (
          <View style={{ paddingTop: (StatusBar.currentHeight ?? 24) + espacio.m, paddingHorizontal: espacio.l }}>
            <Pressable onPress={volver} hitSlop={12} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
              <Text style={[letra.suave, { fontSize: 16 }]}>‹ Volver</Text>
            </Pressable>
          </View>
        ) : (
          // La ilustración empieza bajo la barra de estado, sobre el color de su
          // cielo, y se recorta un poco por arriba y por abajo: gana sitio sin
          // perder las casas.
          <View style={{ paddingTop: StatusBar.currentHeight ?? 24, backgroundColor: CIELO }}>
            <View style={{ width: '100%', aspectRatio: 800 / 200, overflow: 'hidden' }}>
              <Image source={PORTADA} style={{ width: '100%', height: undefined, aspectRatio: 800 / 300, marginTop: '-5%' }} />
            </View>
          </View>
        )}

        <View style={{ paddingHorizontal: espacio.l, marginTop: espacio.s }}>
          <Text style={letra.titulo}>{esHoy ? 'Hoy' : capitalizar(fechaLarga(fecha))}</Text>
          <Text style={[letra.suave, { marginTop: 2 }]}>
            {esHoy ? fechaLarga(fecha) : fecha > hoy ? 'Todavía no ha llegado' : 'Lo que pasó ese día'}
          </Text>

          {avisoEsquema && <Aviso texto={avisoEsquema} />}
          {estado === 'error' && lectura.mensaje && <Aviso texto={lectura.mensaje} tipo="error" />}
          {avisoLectura && <Aviso texto={avisoLectura} />}

          {datos?.escolar && (
            <Aviso texto={`${esHoy ? 'Hoy' : 'Ese día'} no hay cole: ${datos.escolar.descripcion || datos.escolar.tipo}`} />
          )}

          {/* Quién los tiene */}
          <View style={{ flexDirection: 'row', gap: espacio.m, marginTop: espacio.xl }}>
            {datos?.ninos.map((n) => (
              <TarjetaNino key={n.nino_id} nino={n} proximo={datos.proximo_cambio} />
            ))}
          </View>

          {/* Lo apuntado, antes que nada más: sus iconos son el camino de dos toques y
              tienen que verse al abrir, también los días con recogida, mochila y comedor. */}
          {datos && puedeApuntar && (
            <Seccion titulo={esHoy ? 'HOY SE HA APUNTADO' : 'SE APUNTÓ'}>
              {datos.ninos.map((n) => (
                <ResumenApuntes
                  key={n.nino_id}
                  nino={n}
                  registro={registro}
                  alTocar={(tipo) => setHoja({ paso: 'detalle', nino_id: n.nino_id, tipo })}
                />
              ))}
              <Text style={[letra.tenue, { marginTop: espacio.xs }]}>
                Toca un icono para apuntarlo.
                {pendientes > 0 ? `  ${pendientes} sin subir.` : ''}
              </Text>
            </Seccion>
          )}

          {/* Lo que se pregunta uno cada tarde */}
          <Seccion titulo={esHoy ? 'RECOGIDA HOY' : 'RECOGIDA'}>
            {datos?.ninos.map((n) => <FilaRecogida key={n.nino_id} nino={n} />)}
          </Seccion>

          <SeccionEquipamiento titulo={`${diaSiguiente} HAY QUE LLEVAR`} ninos={datos?.ninos ?? []} />

          {(datos?.menu_comedor || mesesConMenu.includes(mesDelDia)) && (
            <Seccion titulo="COMEDOR">
              {datos?.menu_comedor && (
                <Text style={letra.cuerpo}>
                  {[datos.menu_comedor.primero, datos.menu_comedor.segundo, datos.menu_comedor.postre]
                    .filter(Boolean).join(' · ')}
                </Text>
              )}
              {/* El menú del mes en imagen, tal como lo da el colegio. */}
              {mesesConMenu.includes(mesDelDia) && (
                <Pressable onPress={() => router.push(`/menu/${mesDelDia}`)} hitSlop={8} accessibilityRole="button">
                  <Text style={{ color: color.acento, fontWeight: '600', fontSize: 15, marginTop: datos?.menu_comedor ? espacio.s : 0 }}>
                    Menú de {nombreMes(mesDelDia).toLowerCase()} ›
                  </Text>
                </Pressable>
              )}
            </Seccion>
          )}

          {!!datos?.tareas_vencen.length && (
            <Seccion titulo="VENCE PRONTO">
              {datos.tareas_vencen.map((t) => {
                const nino = datos.ninos.find((n) => n.nino_id === t.nino_id);
                const cuando = t.fecha_entrega === datos.fecha
                  ? (esHoy ? 'hoy' : 'ese día')
                  : (esHoy ? 'mañana' : 'al día siguiente');
                return (
                  <View key={t.id} style={{ flexDirection: 'row', gap: espacio.s, paddingVertical: 2 }}>
                    <View style={{
                      width: 4, borderRadius: 2,
                      backgroundColor: nino?.color_hex || color.borde,
                    }} />
                    <Text style={letra.cuerpo}>
                      {nino?.nombre} — {t.titulo}
                      <Text style={letra.tenue}>{'  ' + cuando}</Text>
                    </Text>
                  </View>
                );
              })}
            </Seccion>
          )}

          {!!datos?.tratamientos_activos.length && (
            <Seccion titulo="MEDICACIÓN EN CURSO">
              {datos.tratamientos_activos.map((t) => (
                <Text key={t.id} style={letra.cuerpo}>
                  {datos.ninos.find((n) => n.nino_id === t.nino_id)?.nombre} — {t.titulo}
                  {t.tratamiento ? <Text style={letra.tenue}>{'  ' + t.tratamiento}</Text> : null}
                </Text>
              ))}
            </Seccion>
          )}

          {!!datos?.eventos.length && (
            <Seccion titulo={esHoy ? 'HOY TAMBIÉN' : 'ESE DÍA TAMBIÉN'}>
              {datos.eventos.map((e) => (
                <Text key={e.id} style={letra.cuerpo}>
                  {e.titulo}{e.notas ? <Text style={letra.tenue}>{'  ' + e.notas}</Text> : null}
                </Text>
              ))}
            </Seccion>
          )}

          {/* Las clases del día, del horario fijo del curso. Un día sin cole no trae ninguna. */}
          {datos?.ninos.some((n) => n.clases.length > 0) && (
            <Seccion titulo={esHoy ? 'CLASES DE HOY' : 'CLASES'}>
              {datos.ninos.filter((n) => n.clases.length > 0).map((n, i) => (
                <View key={n.nino_id} style={{ marginTop: i ? espacio.m : 0 }}>
                  <Text style={[letra.cuerpo, { color: n.color_hex, fontWeight: '600', marginBottom: 2 }]}>{n.nombre}</Text>
                  {n.clases.map((c) => {
                    const pausa = /^(esbarjo|dinar|recreo|comedor)/i.test(c.asignatura);
                    return (
                      <View key={c.id} style={{ flexDirection: 'row', gap: espacio.s, paddingVertical: 1 }}>
                        <Text style={[letra.tenue, { width: 44 }]}>{c.hora_inicio}</Text>
                        <Text style={[pausa ? letra.tenue : letra.suave, { flexShrink: 1 }]}>
                          {c.asignatura}
                          {c.equipamiento
                            ? <Text style={{ color: color.acento, fontWeight: '600' }}>{'  · ' + nombreEquipamiento(c.equipamiento)}</Text>
                            : null}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </Seccion>
          )}
        </View>
      </ScrollView>

      {datos && puedeApuntar && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: espacio.xl, alignItems: 'center' }}>
          <Pressable
            onPress={() => setHoja({ paso: 'elegir' })}
            accessibilityRole="button"
            style={{
              backgroundColor: color.acento, borderRadius: 28, elevation: 4,
              paddingHorizontal: espacio.xxl, paddingVertical: espacio.l - 2,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>+ Apuntar</Text>
          </Pressable>
        </View>
      )}

      {aviso && (
        <AvisoDeshacer
          key={aviso.clave}
          texto={aviso.texto}
          alTerminar={cerrarAviso}
          alDeshacer={() => { deshacer(aviso.d); subir(); setAviso(null); }}
        />
      )}

      {datos && puedeApuntar && (
        <HojaApuntar
          inicio={hoja}
          agenda={datos}
          fecha={fecha}
          menus={menus}
          alCerrar={() => setHoja(null)}
          alGuardar={(d, texto) => { setHoja(null); setAviso({ d, texto, clave: Date.now() }); }}
        />
      )}
    </View>
  );
}

// ── piezas ────────────────────────────────────────────────────────────

function TarjetaNino({ nino, proximo }: { nino: NinoDelDia; proximo: RespuestaAgenda['proximo_cambio'] }) {
  const cambio = proximo?.custodia?.[nino.nino_id];
  return (
    <View style={{
      flex: 1, backgroundColor: color.tarjeta, borderRadius: radio.l,
      borderLeftWidth: 4, borderLeftColor: nino.color_hex,
      borderWidth: 1, borderColor: color.borde, padding: espacio.m,
    }}>
      <Text style={[letra.seccion, { color: nino.color_hex }]}>
        {nino.nombre.toUpperCase()}
      </Text>
      <Text style={[letra.dato, { marginTop: espacio.xs }]}>
        {nino.custodia ? `con ${nino.custodia.nombre.toLowerCase()}` : 'sin custodia'}
      </Text>
      {proximo && cambio && (
        <Text style={letra.tenue}>
          → {cambio.nombre.toLowerCase()} el {diaCorto(proximo.fecha)}
        </Text>
      )}
      {!nino.custodia && (
        <Text style={letra.tenue}>revisa custodia_mapeo</Text>
      )}
    </View>
  );
}

function FilaRecogida({ nino }: { nino: NinoDelDia }) {
  const r = nino.recogida;
  if (!r.hay) {
    return (
      <Text style={[letra.suave, { paddingVertical: 2 }]}>
        {nino.nombre} — {r.motivo === 'fin_de_semana' ? 'fin de semana' : (r.descripcion || 'no hay cole')}
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: espacio.s, paddingVertical: 3 }}>
      <Text style={[letra.cuerpo, { width: 62 }]}>{nino.nombre}</Text>
      <Text style={{ fontSize: 22, fontWeight: '700', color: nino.color_hex }}>{r.hora || '—'}</Text>
      <Text style={[letra.suave, { flexShrink: 1 }]}>
        {r.motivo === 'extraescolar' ? r.actividad : r.lugar}
        {r.motivo === 'extraescolar' && r.lugar ? ` · ${r.lugar}` : ''}
      </Text>
    </View>
  );
}

/** Solo aparece si hay algo que preparar. Si no hay nada, no estorba. */
function SeccionEquipamiento({ titulo, ninos }: { titulo: string; ninos: NinoDelDia[] }) {
  const conAlgo = ninos.filter((n) => n.equipamiento_manana.length > 0);
  if (!conAlgo.length) return null;
  return (
    <Seccion titulo={titulo}>
      {conAlgo.map((n) => (
        <View key={n.nino_id} style={{ paddingVertical: 2 }}>
          <Text style={letra.cuerpo}>
            <Text style={{ fontWeight: '600' }}>{n.nombre}</Text>
            {'  '}{n.equipamiento_manana.map((e) => e.nombre).join(' + ')}
          </Text>
          <Text style={letra.tenue}>
            por {n.equipamiento_manana.flatMap((e) => e.porque).join(', ')}
          </Text>
        </View>
      ))}
    </Seccion>
  );
}

function ResumenApuntes({ nino, registro, alTocar }: {
  nino: NinoDelDia;
  registro: ConMarca<RegistroNino>[];
  alTocar: (tipo: RegistroTipo) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 2 }}>
      <Text style={[letra.cuerpo, { width: 62, color: nino.color_hex }]}>{nino.nombre}</Text>
      {TIPOS_RESUMEN.map((t) => {
        const apunte = ultimoApunte(registro, nino.nino_id, t) as ConMarca<RegistroNino> | undefined;
        // Distinguir las tres situaciones: apuntado que sí, apuntado que no, y
        // sin apuntar. No son lo mismo y la app no debe hacer que lo parezcan.
        const marca = !apunte ? '·' : apunte.valor === 'no' ? '✗' : '✓';
        const tono = !apunte ? color.textoTenue : apunte.valor === 'no' ? color.aviso : color.acento;
        const def = definicion(t);
        return (
          <Pressable
            key={t}
            onPress={() => alTocar(t)}
            accessibilityRole="button"
            accessibilityLabel={`${def?.etiqueta} de ${nino.nombre}`}
            android_ripple={{ color: color.borde }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: espacio.s, borderRadius: radio.s }}
          >
            <Text style={{ fontSize: 18 }}>
              {def?.icono}<Text style={{ color: tono, fontWeight: '700' }}>{marca}</Text>
            </Text>
            {/* Punto gris: guardado en el móvil, pendiente de subir. */}
            {apunte?.pendiente && (
              <View style={{
                position: 'absolute', top: 4, right: 6, width: 7, height: 7,
                borderRadius: 4, backgroundColor: color.pendiente,
              }} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: espacio.xl }}>
      <Text style={[letra.seccion, { marginBottom: espacio.s }]}>{titulo}</Text>
      <View style={{
        backgroundColor: color.tarjeta, borderRadius: radio.m,
        borderWidth: 1, borderColor: color.borde, padding: espacio.m,
      }}>
        {children}
      </View>
    </View>
  );
}

function Aviso({ texto, tipo }: { texto: string; tipo?: 'error' }) {
  return (
    <View style={{
      backgroundColor: tipo === 'error' ? '#FDECEA' : '#FEF3C7',
      borderRadius: radio.m, padding: espacio.m, marginTop: espacio.l,
    }}>
      <Text style={{ color: tipo === 'error' ? color.error : color.aviso, fontSize: 14 }}>
        {texto}
      </Text>
    </View>
  );
}
