/**
 * LA FICHA: añadir o corregir una tarea, una lectura o un evento.
 *
 * Un solo formulario para las tres pestañas: los campos salen de la
 * declaración de `src/domain/fichas.ts`, que es el espejo de la hoja. Añadir
 * un campo a la hoja es añadir una línea allí, no una pantalla aquí.
 *
 * No es el registro diario, así que aquí sí hay formulario; pero lo de siempre
 * viene puesto (el niño, el tipo, la fecha de mañana) y guardar es un toque.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  FICHAS, cambiosFicha, normalizar, problemaFicha, resumenFicha, valoresDe, valoresNuevos,
  type CampoFicha, type FilaFicha, type TablaFicha, type Valores,
} from '../../domain/fichas';
import { ahoraMadrid, diaCorto, hoyMadrid, sumarDias } from '../../domain/fechas';
import { nombreMes } from '../../domain/calendario';
import { crearFicha, editarFicha, borrarFicha } from '../../db/fichas';
import type { Deshacer } from '../../db/apuntar';
import { useSesion } from '../../estado/sesion';
import { useCola } from '../../estado/cola';
import { color, espacio, letra, radio } from '../tema';
import Hoja, { BotonGuardar, Campo } from '../Hoja';

export interface AbrirFicha {
  tabla: TablaFicha;
  /** Sin fila, es una ficha nueva. */
  fila?: FilaFicha;
  nino_id: string;
}

interface Props {
  abrir: AbrirFicha | null;
  alCerrar: () => void;
  alGuardar: (d: Deshacer, texto: string) => void;
}

export default function HojaFicha({ abrir, alCerrar, alGuardar }: Props) {
  const { ninos } = useSesion();
  const { subir } = useCola();
  const [valores, setValores] = useState<Valores>({});
  const [intentado, setIntentado] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const tabla = abrir?.tabla ?? 'tareas';
  const def = FICHAS[tabla];
  const fila = abrir?.fila;

  useEffect(() => {
    if (!abrir) return;
    setValores(abrir.fila
      ? valoresDe(abrir.tabla, abrir.fila)
      : valoresNuevos(abrir.tabla, abrir.nino_id));
    setIntentado(false);
    setBorrando(false);
  }, [abrir]);

  const poner = (campo: string) => (texto: string) =>
    setValores((v) => ({ ...v, [campo]: texto }));

  const problema = problemaFicha(tabla, valores);

  function guardar() {
    setIntentado(true);
    if (problema) return;
    const limpios = normalizar(tabla, valores, ahoraMadrid().marca);
    const nombre = resumenFicha(tabla, limpios);
    if (fila) {
      const antes = valoresDe(tabla, fila);
      const d = editarFicha(tabla, fila.id, antes, cambiosFicha(antes, limpios));
      if (!d) { alCerrar(); return; }
      subir();
      alGuardar(d, `${nombre} · corregido`);
      return;
    }
    const { deshacer } = crearFicha(tabla, limpios);
    subir();
    alGuardar(deshacer, `${nombre} · apuntado`);
  }

  function borrar() {
    if (!fila) return;
    // El único sitio donde se pregunta: un borrado no se puede deshacer.
    if (!borrando) { setBorrando(true); return; }
    borrarFicha(tabla, fila.id);
    subir();
    alCerrar();
  }

  return (
    <Hoja visible={!!abrir} alCerrar={alCerrar}>
      <Text style={[letra.titulo, { fontSize: 22, marginBottom: espacio.m }]}>
        {fila ? `Corregir ${def.nombre}` : def.nueva}
      </Text>

      {enLineas(def.campos).map((linea) => (
        <View key={linea[0].campo} style={linea.length > 1 ? { flexDirection: 'row', gap: espacio.m } : undefined}>
          {linea.map((c) => (
            <View key={c.campo} style={linea.length > 1 ? { flex: 1 } : undefined}>
              <UnCampo campo={c} valores={valores} poner={poner} ninos={ninos} tabla={tabla} />
            </View>
          ))}
        </View>
      ))}

      {intentado && problema && (
        <Text style={{ color: color.aviso, fontSize: 15, marginBottom: espacio.s }}>{problema}</Text>
      )}

      {/* Activo hasta que se intenta: así el primer toque dice qué falta en
          vez de dejar un botón apagado sin explicación. */}
      <BotonGuardar activo={!intentado || !problema} alTocar={guardar} />

      {fila && (
        <Pressable
          onPress={borrar}
          style={{ marginTop: espacio.m, paddingVertical: espacio.m, alignItems: 'center' }}
        >
          <Text style={{ color: borrando ? color.error : color.textoSuave, fontSize: 15, fontWeight: borrando ? '700' : '400' }}>
            {borrando ? 'Tocar otra vez para borrar' : `Borrar ${def.nombre}`}
          </Text>
        </Pressable>
      )}
    </Hoja>
  );
}

/** Los campos cortos marcados 'media' se emparejan de dos en dos. */
function enLineas(campos: CampoFicha[]): CampoFicha[][] {
  const lineas: CampoFicha[][] = [];
  campos.forEach((c) => {
    const ultima = lineas[lineas.length - 1];
    if (c.media && ultima?.length === 1 && ultima[0].media) ultima.push(c);
    else lineas.push([c]);
  });
  return lineas;
}

// ── los campos, uno por clase ───────────────────────────────────────────

function UnCampo({ campo, valores, poner, ninos, tabla }: {
  campo: CampoFicha;
  valores: Valores;
  poner: (campo: string) => (t: string) => void;
  ninos: { id: string; nombre: string; color_hex?: string }[];
  tabla: TablaFicha;
}) {
  const valor = valores[campo.campo] ?? '';
  const cambiar = poner(campo.campo);
  const aviso = campo.aviso?.(valores) ?? null;
  if (aviso) {
    return (
      <View>
        <UnCampo campo={{ ...campo, aviso: undefined }} valores={valores} poner={poner} ninos={ninos} tabla={tabla} />
        <Text style={{ color: color.aviso, fontSize: 14, marginTop: -espacio.s, marginBottom: espacio.m }}>
          {aviso}
        </Text>
      </View>
    );
  }

  if (campo.clase === 'nino') {
    return (
      <Opciones
        etiqueta={campo.etiqueta}
        valor={valor}
        alElegir={cambiar}
        opciones={[
          ...ninos.map((n) => ({ valor: n.id, texto: n.nombre })),
          // Un evento sin niño es de los dos; una tarea siempre es de alguien.
          ...(tabla === 'eventos' ? [{ valor: '', texto: 'Los dos' }] : []),
        ]}
      />
    );
  }
  if (campo.clase === 'opciones') {
    return <Opciones etiqueta={campo.etiqueta} valor={valor} alElegir={cambiar} opciones={campo.opciones ?? []} />;
  }
  if (campo.clase === 'fecha') {
    return <CampoFecha etiqueta={campo.etiqueta} valor={valor} alCambiar={cambiar} quitable={!campo.requerido} />;
  }
  if (campo.clase === 'estrellas') {
    return <Estrellas etiqueta={campo.etiqueta} valor={valor} alCambiar={cambiar} />;
  }
  return (
    <Campo
      etiqueta={campo.etiqueta}
      valor={valor}
      alCambiar={cambiar}
      ayuda={campo.ayuda ?? (campo.clase === 'hora' ? '17:30' : undefined)}
      multilinea={campo.clase === 'parrafo'}
      numerico={campo.clase === 'numero' || campo.clase === 'decimal'}
    />
  );
}

function Opciones({ etiqueta, valor, opciones, alElegir }: {
  etiqueta: string; valor: string; opciones: { valor: string; texto: string }[]; alElegir: (v: string) => void;
}) {
  return (
    <View style={{ marginBottom: espacio.m }}>
      <Text style={[letra.seccion, { marginBottom: espacio.xs }]}>{etiqueta.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s }}>
        {opciones.map((o) => (
          <Chip key={o.valor} texto={o.texto} activo={o.valor === valor} alTocar={() => alElegir(o.valor)} />
        ))}
      </View>
    </View>
  );
}

/**
 * La fecha, sin teclado: los dos días de siempre a un toque y las flechas para
 * lo demás. Escribir '2026-10-09' a mano en un móvil es pedir una errata.
 */
function CampoFecha({ etiqueta, valor, alCambiar, quitable }: {
  etiqueta: string; valor: string; alCambiar: (v: string) => void; quitable?: boolean;
}) {
  const hoy = hoyMadrid();
  const manana = sumarDias(hoy, 1);
  const base = valor || hoy;
  return (
    <View style={{ marginBottom: espacio.m }}>
      <Text style={[letra.seccion, { marginBottom: espacio.xs }]}>{etiqueta.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
        <Flecha texto="‹" alTocar={() => alCambiar(sumarDias(base, -1))} />
        <View style={{
          flex: 1, alignItems: 'center', paddingVertical: espacio.m,
          backgroundColor: color.tarjeta, borderWidth: 1, borderColor: color.borde, borderRadius: radio.m,
        }}>
          <Text style={{ fontSize: 16, color: valor ? color.texto : color.textoTenue }}>
            {valor ? enPalabras(valor, hoy) : 'Sin fecha'}
          </Text>
        </View>
        <Flecha texto="›" alTocar={() => alCambiar(sumarDias(base, 1))} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: espacio.s, marginTop: espacio.s }}>
        <Chip texto="Hoy" activo={valor === hoy} alTocar={() => alCambiar(hoy)} />
        <Chip texto="Mañana" activo={valor === manana} alTocar={() => alCambiar(manana)} />
        <Chip texto="+1 semana" activo={false} alTocar={() => alCambiar(sumarDias(base, 7))} />
        {quitable && <Chip texto="Sin fecha" activo={!valor} alTocar={() => alCambiar('')} />}
      </View>
    </View>
  );
}

/** 'hoy', 'mañana', o 'vie 9 de octubre'. */
function enPalabras(iso: string, hoy: string) {
  if (iso === hoy) return 'Hoy';
  if (iso === sumarDias(hoy, 1)) return 'Mañana';
  if (iso === sumarDias(hoy, -1)) return 'Ayer';
  return `${diaCorto(iso)} ${Number(iso.slice(8, 10))} de ${nombreMes(iso).toLowerCase()}`;
}

function Estrellas({ etiqueta, valor, alCambiar }: {
  etiqueta: string; valor: string; alCambiar: (v: string) => void;
}) {
  const puestas = Number(valor) || 0;
  return (
    <View style={{ marginBottom: espacio.m }}>
      <Text style={[letra.seccion, { marginBottom: espacio.xs }]}>{etiqueta.toUpperCase()}</Text>
      <View style={{ flexDirection: 'row', gap: espacio.s }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => alCambiar(puestas === n ? '' : String(n))}
            hitSlop={6}
            accessibilityLabel={`${n} de 5`}
          >
            <Text style={{ fontSize: 28, color: n <= puestas ? '#E6A700' : color.borde }}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Chip({ texto, activo, alTocar }: { texto: string; activo: boolean; alTocar: () => void }) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      style={{
        paddingVertical: espacio.s, paddingHorizontal: espacio.m, borderRadius: 20,
        backgroundColor: activo ? '#E6EFE5' : color.tarjeta,
        borderWidth: 1, borderColor: activo ? color.acento : color.borde,
      }}
    >
      <Text style={{ fontSize: 15, color: activo ? color.acento : color.textoSuave, fontWeight: activo ? '600' : '400' }}>
        {texto}
      </Text>
    </Pressable>
  );
}

function Flecha({ texto, alTocar }: { texto: string; alTocar: () => void }) {
  return (
    <Pressable
      onPress={alTocar}
      hitSlop={8}
      style={{
        width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
        backgroundColor: color.tarjeta, borderWidth: 1, borderColor: color.borde, borderRadius: radio.m,
      }}
    >
      <Text style={{ fontSize: 22, color: color.textoSuave }}>{texto}</Text>
    </Pressable>
  );
}
