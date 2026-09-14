/**
 * El menú del comedor de un mes, tal como lo da el colegio: una imagen.
 *
 * Se ve a todo el ancho; tocarla la amplía para leer la letra pequeña y volver a
 * tocarla la deja entera. Las flechas pasan a los otros meses que hay en la
 * carpeta. Sin red, se ve la última imagen descargada.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, Image, ActivityIndicator, StatusBar, useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMenuImagen, useMenusComedor } from '../../src/estado/menus';
import { nombreMes } from '../../src/domain/calendario';
import { hoyMadrid } from '../../src/domain/fechas';
import { color, espacio, letra, radio } from '../../src/ui/tema';

const AMPLIACION = 2.2;

export default function Menu() {
  const params = useLocalSearchParams<{ mes: string }>();
  const [mes, setMes] = useState(() =>
    typeof params.mes === 'string' && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : hoyMadrid().slice(0, 7));
  const { meses } = useMenusComedor();
  const imagen = useMenuImagen(mes);
  const { width } = useWindowDimensions();
  const [proporcion, setProporcion] = useState<number | null>(null);
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    setProporcion(null);
    setAmpliada(false);
    if (imagen.uri) Image.getSize(imagen.uri, (w, h) => setProporcion(w / h), () => setProporcion(null));
  }, [imagen.uri]);

  const posicion = meses.indexOf(mes);
  const anterior = posicion > 0 ? meses[posicion - 1] : null;
  const siguiente = posicion >= 0 && posicion < meses.length - 1 ? meses[posicion + 1] : null;
  const ancho = (width - 2 * espacio.l) * (ampliada ? AMPLIACION : 1);

  function volver() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.fondo, paddingTop: (StatusBar.currentHeight ?? 24) + espacio.m }}>
      <View style={{ paddingHorizontal: espacio.l }}>
        <Pressable onPress={volver} hitSlop={12} accessibilityRole="button" style={{ alignSelf: 'flex-start' }}>
          <Text style={[letra.suave, { fontSize: 16 }]}>‹ Volver</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s, marginTop: espacio.s }}>
          <Pressable onPress={() => anterior && setMes(anterior)} disabled={!anterior} hitSlop={12} accessibilityLabel="Mes anterior">
            <Text style={{ fontSize: 26, color: anterior ? color.textoSuave : color.borde }}>‹</Text>
          </Pressable>
          <Text style={[letra.titulo, { flexShrink: 1 }]}>Menú de {nombreMes(mes).toLowerCase()}</Text>
          <Pressable onPress={() => siguiente && setMes(siguiente)} disabled={!siguiente} hitSlop={12} accessibilityLabel="Mes siguiente">
            <Text style={{ fontSize: 26, color: siguiente ? color.textoSuave : color.borde }}>›</Text>
          </Pressable>
        </View>
        {imagen.uri && proporcion && (
          <Text style={letra.tenue}>
            {ampliada ? 'Toca la imagen para verla entera.' : 'Toca la imagen para ampliarla.'}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: espacio.l, paddingBottom: espacio.xxl }}>
        {imagen.uri && proporcion ? (
          <ScrollView horizontal scrollEnabled={ampliada} showsHorizontalScrollIndicator={ampliada}>
            <Pressable onPress={() => setAmpliada(!ampliada)} accessibilityLabel={ampliada ? 'Ver entera' : 'Ampliar'}>
              <Image
                source={{ uri: imagen.uri }}
                style={{ width: ancho, height: ancho / proporcion, borderRadius: radio.s, backgroundColor: color.tarjeta }}
              />
            </Pressable>
          </ScrollView>
        ) : imagen.noHay ? (
          <Text style={letra.suave}>Todavía no hay imagen de este mes en la carpeta del menú.</Text>
        ) : imagen.uri || imagen.estado === 'cargando' ? (
          <ActivityIndicator color={color.acento} style={{ marginTop: espacio.xl }} />
        ) : (
          <View style={{ backgroundColor: '#FEF3C7', borderRadius: radio.m, padding: espacio.m }}>
            <Text style={{ color: color.aviso, fontSize: 14 }}>
              {imagen.estado === 'sin_red'
                ? 'Sin conexión, y este menú todavía no está guardado en el móvil.'
                : imagen.mensaje ?? 'No se ha podido cargar el menú.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
