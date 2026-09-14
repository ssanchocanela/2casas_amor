import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useSesion } from '../../src/estado/sesion';
import { useCola } from '../../src/estado/cola';
import { pendientes, retirar, type Operacion } from '../../src/db/cola';
import { color, espacio, letra, radio } from '../../src/ui/tema';

export default function Ajustes() {
  const { yo, personas, ninos, config, credenciales, salir, refrescar } = useSesion();
  const [refrescando, setRefrescando] = useState(false);
  const quienSoy = personas.find((p) => p.id === yo);

  async function comprobar() {
    setRefrescando(true);
    try {
      await refrescar();
      Alert.alert('Conexión correcta', 'La hoja responde y los datos están al día.');
    } catch (e: any) {
      Alert.alert('No se ha podido conectar', e?.message ?? 'Error desconocido');
    } finally {
      setRefrescando(false);
    }
  }

  function desconectar() {
    Alert.alert(
      'Desconectar este móvil',
      'Se borrarán la dirección y el token guardados. Los datos de la hoja no se tocan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desconectar', style: 'destructive', onPress: () => salir() },
      ],
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.fondo }}
      contentContainerStyle={{ padding: espacio.l, paddingTop: 56, paddingBottom: 96 }}
    >
      <Text style={letra.titulo}>Ajustes</Text>

      <Bloque titulo="QUIÉN SOY">
        <Text style={letra.dato}>{quienSoy?.nombre ?? '—'}</Text>
        <Text style={letra.tenue}>
          {quienSoy?.rol ?? ''} · {yo ?? ''}
        </Text>
        <Text style={[letra.tenue, { marginTop: espacio.s }]}>
          Sale del token de este móvil. Para cambiarlo hay que desconectar y
          entrar con otro token.
        </Text>
      </Bloque>

      <Bloque titulo="CONEXIÓN">
        <Text style={letra.tenue} numberOfLines={2}>
          {credenciales?.url ?? '—'}
        </Text>
        <Pressable
          onPress={comprobar}
          disabled={refrescando}
          style={{
            marginTop: espacio.m, backgroundColor: color.acento,
            borderRadius: radio.s, paddingVertical: espacio.m, alignItems: 'center',
          }}
        >
          {refrescando
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '600' }}>Probar conexión</Text>}
        </Pressable>
      </Bloque>

      <Sincronizacion />

      <Bloque titulo="NIÑOS">
        {ninos.map((n) => (
          <View key={n.id} style={{ paddingVertical: espacio.xs }}>
            <Text style={[letra.cuerpo, { color: n.color_hex, fontWeight: '600' }]}>
              {n.nombre}
            </Text>
            <Text style={letra.tenue}>
              {[n.curso, n.grupo].filter(Boolean).join(' · ')}
              {n.alergias ? `  ·  alergias: ${n.alergias}` : ''}
            </Text>
          </View>
        ))}
      </Bloque>

      <Bloque titulo="HOJA">
        <Dato etiqueta="Curso" valor={config.curso_escolar} />
        <Dato etiqueta="Centro" valor={config.centro_escolar} />
        <Dato etiqueta="Esquema" valor={config.version_esquema} />
        <Dato etiqueta="Entorno" valor={config.entorno} />
      </Bloque>

      <Pressable onPress={desconectar} style={{ marginTop: espacio.xl, alignItems: 'center' }}>
        <Text style={{ color: color.error, fontSize: 15 }}>Desconectar este móvil</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * Lo que falta por subir. Un apunte que el backend rechaza no bloquea a los
 * demás, pero tampoco puede quedarse escondido: aquí se ve con su motivo.
 */
function Sincronizacion() {
  const { ninos } = useSesion();
  const { pendientes: cuantos, subir } = useCola();
  const [subiendo, setSubiendo] = useState(false);
  const fallidos = pendientes().filter((o) => o.error);

  async function subirAhora() {
    setSubiendo(true);
    try { await subir(); } finally { setSubiendo(false); }
  }

  function descartar(o: Operacion) {
    Alert.alert(
      'Descartar este cambio',
      'No llegará nunca a la hoja. Hazlo solo si el backend lo rechaza una y otra vez.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => { retirar(o.id_local); } },
      ],
    );
  }

  function describir(o: Operacion) {
    const d = o.datos as Record<string, string | undefined>;
    const nino = ninos.find((n) => n.id === d.nino_id)?.nombre;
    const que = o.tabla === 'menu_casa'
      ? 'menú de la casa'
      : [d.tipo?.replace('_', ' '), nino].filter(Boolean).join(' de ') || o.tabla;
    const accion = { create: 'Apunte', update: 'Cambio', delete: 'Deshacer' }[o.accion];
    return `${accion} · ${que}${d.fecha ? ` · ${d.fecha}` : ''}`;
  }

  return (
    <Bloque titulo="SINCRONIZACIÓN">
      <Text style={letra.cuerpo}>
        {cuantos === 0 ? 'Todo subido.' : `${cuantos} ${cuantos === 1 ? 'cambio' : 'cambios'} sin subir.`}
      </Text>
      {fallidos.map((o) => (
        <View key={o.id_local} style={{ marginTop: espacio.m, borderTopWidth: 1, borderTopColor: color.borde, paddingTop: espacio.s }}>
          <Text style={letra.suave}>{describir(o)}</Text>
          <Text style={{ color: color.error, fontSize: 13, marginTop: 2 }}>
            {o.error} · {o.intentos} {o.intentos === 1 ? 'intento' : 'intentos'}
          </Text>
          <Pressable onPress={() => descartar(o)} hitSlop={8} style={{ marginTop: espacio.xs }}>
            <Text style={{ color: color.error, fontSize: 14, fontWeight: '600' }}>Descartar</Text>
          </Pressable>
        </View>
      ))}
      {cuantos > 0 && (
        <Pressable
          onPress={subirAhora}
          disabled={subiendo}
          style={{
            marginTop: espacio.m, backgroundColor: color.acento,
            borderRadius: radio.s, paddingVertical: espacio.m, alignItems: 'center',
          }}
        >
          {subiendo
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '600' }}>Subir ahora</Text>}
        </Pressable>
      )}
    </Bloque>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
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

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text style={letra.suave}>{etiqueta}</Text>
      <Text style={letra.cuerpo}>{valor || '—'}</Text>
    </View>
  );
}
