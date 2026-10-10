/**
 * APUNTAR — la hoja que sube desde abajo.
 *
 * Tres pasos, y casi nunca se ven los tres:
 *   · elegir:  niño (o los dos) y qué. Lo de la casa, aparte, porque es de la
 *              casa y no de un niño.
 *   · detalle: sí/no o caritas, que guardan al tocar; o texto, con su botón.
 *   · menú:    qué se ha cocinado hoy en esta casa. Si ya está, se edita.
 *
 * Desde los iconos de Hoy se entra directo al detalle: dos toques hasta guardar.
 * La casa y el autor se rellenan solos. Se corrigen tocándolos; nunca se preguntan.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import type { MenuCasa, NinoId, RegistroNino, RegistroTipo, RespuestaAgenda } from '../../domain/tipos';
import {
  APUNTES, avisoSinSi, caritasDe, definicion, nuevoMenuCasa, nuevoRegistro, problemaDelDato,
  ultimaSemana, type CamposMenu, type DatoApunte, type DefinicionApunte,
} from '../../domain/apuntes';
import { ahoraMadrid, diaYNumero, sumarDias } from '../../domain/fechas';
import { guardarMenu, guardarRegistros, type Deshacer } from '../../db/apuntar';
import { conPendientes } from '../../db/cola';
import { recordar, recuperar } from '../../db/cache';
import { useFilas } from '../../estado/lectura';
import { useSesion } from '../../estado/sesion';
import { useCola } from '../../estado/cola';
import { color, espacio, letra, radio, tonoApunte } from '../tema';
import Hoja, { BotonGuardar, Cabecera, Campo } from '../Hoja';
import Segmento from '../Segmento';

export type InicioApuntar =
  | { paso: 'elegir' }
  | { paso: 'detalle'; nino_id: NinoId; tipo: RegistroTipo }
  | { paso: 'menu' };

type Paso = InicioApuntar['paso'];
type Seleccion = NinoId | 'los_dos';

const LOS_DOS = 'los_dos';
const CLAVE_ULTIMO_NINO = 'ultimo_nino';

const TONO = tonoApunte;

interface Props {
  inicio: InicioApuntar | null;
  agenda: RespuestaAgenda;
  /** El día que se apunta: hoy, o un día pasado abierto desde Calendario. */
  fecha: string;
  /** Los menús de ese día, con lo pendiente ya mezclado. */
  menus: MenuCasa[];
  alCerrar: () => void;
  alGuardar: (d: Deshacer, texto: string) => void;
}

export default function HojaApuntar({ inicio, agenda, fecha, menus, alCerrar, alGuardar }: Props) {
  const { yo, personas } = useSesion();
  const { subir } = useCola();
  const [paso, setPaso] = useState<Paso>('elegir');
  const [tipo, setTipo] = useState<RegistroTipo>('caca');
  const [seleccion, setSeleccion] = useState<Seleccion>('');
  // null: lo que sale solo (la casa de la custodia, el autor del token).
  const [casa, setCasa] = useState<string | null>(null);
  const [autor, setAutor] = useState<string | null>(null);

  useEffect(() => {
    if (!inicio) return;
    setCasa(null);
    setAutor(null);
    setPaso(inicio.paso);
    if (inicio.paso === 'detalle') {
      setSeleccion(inicio.nino_id);
      setTipo(inicio.tipo);
    } else {
      setSeleccion(ninoInicial(agenda, yo));
    }
  }, [inicio]); // eslint-disable-line react-hooks/exhaustive-deps

  const ninos = agenda.ninos;
  const elegidos = seleccion === LOS_DOS ? ninos.map((n) => n.nino_id) : [seleccion];
  const nombres = seleccion === LOS_DOS
    ? ninos.map((n) => n.nombre).join(' y ')
    : ninos.find((n) => n.nino_id === seleccion)?.nombre ?? '';
  const colorNinos = seleccion === LOS_DOS
    ? color.texto
    : ninos.find((n) => n.nino_id === seleccion)?.color_hex ?? color.texto;

  const casaDe = (nino: NinoId) =>
    casa ?? ninos.find((n) => n.nino_id === nino)?.custodia?.persona_id ?? '';
  // Lo de la casa: la de quien apunta si tiene a alguno de los niños; si no, la de la custodia.
  const casaMenu = casa ?? (ninos.some((n) => n.custodia?.persona_id === yo)
    ? yo ?? '' : ninos[0]?.custodia?.persona_id ?? '');

  const nombreDe = (id: string) =>
    personas.find((p) => p.id === id)?.nombre
    ?? ninos.find((n) => n.custodia?.persona_id === id)?.custodia?.nombre
    ?? '';

  const progenitores = personas.filter((p) => p.rol === 'progenitor').map((p) => p.id);
  const todas = personas.map((p) => p.id);
  // 'hoy' es el día que se apunta; esHoy dice si de verdad es hoy.
  const hoy = fecha;
  const esHoy = fecha === ahoraMadrid().fecha;

  function circunstancias(casaId: string) {
    const ahora = ahoraMadrid();
    // Un día pasado: su fecha, sin hora (no se sabe), y la marca de cuándo se apuntó.
    return esHoy
      ? { ...ahora, casa_persona_id: casaId, autor_id: autor ?? '' }
      : { fecha, hora: '', marca: ahora.marca, casa_persona_id: casaId, autor_id: autor ?? '' };
  }

  function guardarDelNino(dato: DatoApunte) {
    const def = definicion(tipo);
    if (!def || problemaDelDato(tipo, dato)) return;
    const registros: RegistroNino[] = elegidos.map((n) =>
      nuevoRegistro(circunstancias(casaDe(n)), n, tipo, dato));
    const d = guardarRegistros(registros);
    subir();
    alGuardar(d, `${nombres} · ${def.etiqueta.toLowerCase()}${resumen(def, tipo, dato)}${esHoy ? '' : ` · ${diaYNumero(fecha)}`}`);
  }

  function guardarDeLaCasa(campos: CamposMenu) {
    const actual = menus.find((m) => m.fecha === hoy && m.casa_persona_id === casaMenu);
    const d = guardarMenu(actual, nuevoMenuCasa(circunstancias(casaMenu), campos), campos);
    if (!d) { alCerrar(); return; }
    subir();
    const cuando = esHoy ? 'de hoy' : `del ${diaYNumero(fecha)}`;
    alGuardar(d, actual ? `Menú ${cuando} corregido` : `Menú ${cuando} apuntado`);
  }

  function elegirNino(s: Seleccion) {
    setSeleccion(s);
    if (s !== LOS_DOS) recordar(CLAVE_ULTIMO_NINO, s);
  }

  // Casa y autor: se ven, y se corrigen tocando. Nunca se preguntan.
  const linea = (casaId: string) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 2, marginBottom: espacio.l }}>
      <Pressable onPress={() => setCasa(siguiente(progenitores, casaId))} hitSlop={8}>
        <Text style={letra.suave}>
          {diaYNumero(hoy)}, {casaId ? `en casa de ${nombreDe(casaId).toLowerCase()}` : 'casa sin saber'}
        </Text>
      </Pressable>
      <Pressable onPress={() => setAutor(siguiente(todas, autor ?? yo ?? ''))} hitSlop={8}>
        <Text style={letra.tenue}>
          {'  ·  apunta '}{(nombreDe(autor ?? yo ?? '') || 'tú').toLowerCase()}
        </Text>
      </Pressable>
    </View>
  );

  const volver = () => setPaso('elegir');
  const def = definicion(tipo);

  return (
    <Hoja
      visible={!!inicio}
      alCerrar={alCerrar}
      alAtras={paso === 'elegir' ? alCerrar : volver}
    >
      {paso === 'elegir' && (
        <>
          <Text style={[letra.titulo, { fontSize: 22, marginBottom: espacio.m }]}>Apuntar</Text>
          <Segmento
            opciones={[
              ...ninos.map((n) => ({ valor: n.nino_id, texto: n.nombre, tono: n.color_hex })),
              { valor: LOS_DOS, texto: 'Los dos', tono: color.acento },
            ]}
            valor={seleccion}
            alCambiar={elegirNino}
          />
          <View style={{
            flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
            rowGap: espacio.s, marginTop: espacio.m,
          }}>
            {APUNTES.map((a) => (
              <Casilla
                key={a.tipo}
                apunte={a}
                activa={seleccion !== LOS_DOS || a.admiteLosDos}
                alTocar={() => { setTipo(a.tipo); setPaso('detalle'); }}
              />
            ))}
          </View>

          <Text style={[letra.seccion, { marginTop: espacio.xl, marginBottom: espacio.s }]}>
            LO DE LA CASA
          </Text>
          <Pressable
            onPress={() => setPaso('menu')}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: espacio.m,
              backgroundColor: color.tarjeta, borderRadius: radio.m,
              borderWidth: 1, borderColor: color.borde, padding: espacio.m,
            }}
          >
            <Text style={{ fontSize: 26 }}>🍳</Text>
            <View style={{ flex: 1 }}>
              <Text style={[letra.cuerpo, { fontWeight: '600' }]}>{esHoy ? 'Qué se ha cocinado hoy' : 'Qué se cocinó ese día'}</Text>
              <Text style={letra.tenue} numberOfLines={1}>
                {resumenMenu(menus.find((m) => m.fecha === hoy && m.casa_persona_id === casaMenu))
                  ?? 'Comida, cena y fruta · una vez al día'}
              </Text>
            </View>
            <Text style={[letra.suave, { fontSize: 20 }]}>›</Text>
          </Pressable>
        </>
      )}

      {paso === 'detalle' && def && (
        <>
          <Cabecera alVolver={volver}>
            <Text style={{ color: colorNinos }}>{nombres}</Text> · {def.etiqueta}
          </Cabecera>
          {linea(casaDe(elegidos[0]))}

          {def.detalle === 'si_no' && (
            <View style={{ flexDirection: 'row', gap: espacio.m }}>
              <BotonGrande texto="Sí" relleno alTocar={() => guardarDelNino({ valor: 'si' })} />
              <BotonGrande texto="No" alTocar={() => guardarDelNino({ valor: 'no' })} />
            </View>
          )}

          {def.detalle === 'escala' && (
            <View style={{ flexDirection: 'row', gap: espacio.xs }}>
              {caritasDe(tipo).map((c) => (
                <Pressable
                  key={c.escala}
                  onPress={() => guardarDelNino({ escala: c.escala })}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: espacio.l,
                    backgroundColor: color.tarjeta, borderRadius: radio.m,
                    borderWidth: 1, borderColor: color.borde,
                  }}
                >
                  <Text style={{ fontSize: 30 }}>{c.icono}</Text>
                  <Text style={[letra.tenue, { fontSize: 12, marginTop: espacio.xs }]}>{c.texto}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {def.detalle === 'texto' && (
            <DetalleTexto
              tipo={tipo}
              sugerencias={tipo === 'medicacion'
                ? agenda.tratamientos_activos
                  .filter((t) => elegidos.includes(t.nino_id))
                  .map((t) => [t.titulo, t.tratamiento].filter(Boolean).join(' · '))
                : []}
              alGuardar={(texto) => guardarDelNino({ valor: texto })}
            />
          )}

          {def.detalle === 'si_no' && seleccion !== LOS_DOS && (
            <UltimaSemana nino_id={seleccion} tipo={tipo} hoy={hoy} />
          )}
        </>
      )}

      {paso === 'menu' && (
        <>
          <Cabecera alVolver={volver}>Lo de la casa</Cabecera>
          {linea(casaMenu)}
          <DetalleMenu
            key={casaMenu}
            actual={menus.find((m) => m.fecha === hoy && m.casa_persona_id === casaMenu)}
            alGuardar={guardarDeLaCasa}
          />
        </>
      )}
    </Hoja>
  );
}

// ── decisiones pequeñas ─────────────────────────────────────────────────

/** El niño que viene elegido: el único que está en casa de quien apunta; si no, el último usado. */
function ninoInicial(agenda: RespuestaAgenda, yo: string | null): NinoId {
  const enMiCasa = agenda.ninos.filter((n) => n.custodia?.persona_id === yo);
  if (enMiCasa.length === 1) return enMiCasa[0].nino_id;
  const ultimo = recuperar<string>(CLAVE_ULTIMO_NINO);
  return agenda.ninos.find((n) => n.nino_id === ultimo)?.nino_id ?? agenda.ninos[0]?.nino_id ?? '';
}

function siguiente(lista: string[], actual: string) {
  if (!lista.length) return actual;
  return lista[(lista.indexOf(actual) + 1) % lista.length];
}

function resumen(def: DefinicionApunte, tipo: RegistroTipo, dato: DatoApunte) {
  if (def.detalle === 'si_no') return `: ${dato.valor === 'si' ? 'sí' : 'no'}`;
  if (def.detalle === 'escala') return `: ${caritasDe(tipo).find((c) => c.escala === dato.escala)?.texto ?? ''}`;
  return '';
}

function resumenMenu(m?: MenuCasa) {
  if (!m) return null;
  const partes = [m.comida, m.cena, m.fruta].filter(Boolean);
  return partes.length ? `Apuntado: ${partes.join(' · ')}` : null;
}

// ── piezas ──────────────────────────────────────────────────────────────

function Casilla({ apunte, activa, alTocar }: {
  apunte: DefinicionApunte; activa: boolean; alTocar: () => void;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={!activa}
      style={{
        width: '23.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: color.tarjeta, borderRadius: radio.m,
        borderWidth: 1, borderColor: color.borde, opacity: activa ? 1 : 0.35,
      }}
    >
      <Text style={{ fontSize: 28 }}>{apunte.icono}</Text>
      <Text style={{ fontSize: 12, color: color.textoSuave, marginTop: espacio.xs }}>{apunte.etiqueta}</Text>
    </Pressable>
  );
}

function BotonGrande({ texto, relleno, alTocar }: { texto: string; relleno?: boolean; alTocar: () => void }) {
  return (
    <Pressable
      onPress={alTocar}
      style={{
        flex: 1, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: radio.l,
        backgroundColor: relleno ? color.acento : color.tarjeta,
        borderWidth: 2, borderColor: relleno ? color.acento : color.aviso,
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: '700', color: relleno ? '#fff' : color.aviso }}>{texto}</Text>
    </Pressable>
  );
}

function DetalleTexto({ tipo, sugerencias, alGuardar }: {
  tipo: RegistroTipo; sugerencias: string[]; alGuardar: (texto: string) => void;
}) {
  const [texto, setTexto] = useState('');
  // Una observación en una app compartida acaba usándose, tarde o temprano, para
  // decir algo que no es sobre el niño. La ayuda lo enmarca.
  const ayuda = tipo === 'observacion'
    ? 'Lo que el otro necesita saber sobre el niño.'
    : 'Qué y cuánto.';
  return (
    <>
      {sugerencias.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginBottom: espacio.m }}>
          {sugerencias.map((s) => (
            <Pressable
              key={s}
              onPress={() => setTexto(s)}
              style={{
                paddingVertical: espacio.s, paddingHorizontal: espacio.m, borderRadius: 20,
                backgroundColor: '#E6EFE5',
              }}
            >
              <Text style={{ color: color.acento, fontSize: 14 }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
      <Campo etiqueta={tipo === 'observacion' ? 'Nota' : 'Medicación'} valor={texto} alCambiar={setTexto} ayuda={ayuda} multilinea />
      <BotonGuardar activo={!!texto.trim()} alTocar={() => alGuardar(texto)} />
    </>
  );
}

function DetalleMenu({ actual, alGuardar }: { actual?: MenuCasa; alGuardar: (c: CamposMenu) => void }) {
  const [campos, setCampos] = useState<CamposMenu>({
    comida: actual?.comida ?? '', cena: actual?.cena ?? '',
    fruta: actual?.fruta ?? '', notas: actual?.notas ?? '',
  });
  const poner = (k: keyof CamposMenu) => (t: string) => setCampos((c) => ({ ...c, [k]: t }));
  const algo = Object.values(campos).some((v) => v?.trim());
  return (
    <>
      <Campo etiqueta="Comida" valor={campos.comida ?? ''} alCambiar={poner('comida')} />
      <Campo etiqueta="Cena" valor={campos.cena ?? ''} alCambiar={poner('cena')} />
      <Campo etiqueta="Fruta" valor={campos.fruta ?? ''} alCambiar={poner('fruta')} />
      <Campo
        etiqueta="Notas"
        valor={campos.notas ?? ''}
        alCambiar={poner('notas')}
        ayuda="Lo que el otro necesita saber sobre los niños."
        multilinea
      />
      <BotonGuardar activo={algo || !!actual} alTocar={() => alGuardar(campos)} />
    </>
  );
}

/**
 * La franja ámbar y la semana: el porqué de guardar el "no". Sin ese dato no se
 * puede avisar de nada. Se pinta con lo último que se supo si no hay red.
 */
function UltimaSemana({ nino_id, tipo, hoy }: { nino_id: NinoId; tipo: RegistroTipo; hoy: string }) {
  const desde = sumarDias(hoy, -6);
  const { filas } = useFilas<RegistroNino>('registro_nino', { desde, hasta: hoy, nino: nino_id });
  const semana = ultimaSemana(
    conPendientes('registro_nino', filas, (r) => r.nino_id === nino_id && r.fecha >= desde),
    nino_id, tipo, hoy,
  );
  const aviso = avisoSinSi(semana, hoy);

  return (
    <View style={{ marginTop: espacio.l }}>
      {aviso && (
        <View style={{ backgroundColor: '#FEF3C7', borderRadius: radio.m, padding: espacio.m, marginBottom: espacio.l }}>
          <Text style={{ color: color.aviso, fontSize: 15 }}>{aviso}</Text>
        </View>
      )}
      <Text style={[letra.seccion, { marginBottom: espacio.s }]}>ÚLTIMA SEMANA</Text>
      <View style={{ flexDirection: 'row', gap: espacio.xs }}>
        {semana.map((d) => (
          <View key={d.fecha} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[letra.tenue, { fontSize: 12, marginBottom: espacio.xs }]}>{d.letra}</Text>
            <View style={{
              alignSelf: 'stretch', aspectRatio: 1, borderRadius: radio.s,
              alignItems: 'center', justifyContent: 'center', backgroundColor: TONO[d.estado].fondo,
            }}>
              <Text style={{ color: TONO[d.estado].texto, fontWeight: '700', fontSize: 16 }}>
                {d.estado === 'si' ? '✓' : d.estado === 'no' ? '✗' : '·'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
