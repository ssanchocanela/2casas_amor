import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { espacio, radio } from './tema';

const SEGUNDOS = 6;

/**
 * "Guardado · Deshacer" durante unos segundos. Sustituye a los diálogos de
 * confirmación: una pregunta en cada cena es la forma más rápida de que la app
 * se abandone. Para reiniciar la cuenta, cambia la 'key' del componente.
 */
export default function AvisoDeshacer({ texto, alDeshacer, alTerminar }: {
  texto: string;
  alDeshacer: () => void;
  alTerminar: () => void;
}) {
  useEffect(() => {
    const reloj = setTimeout(alTerminar, SEGUNDOS * 1000);
    return () => clearTimeout(reloj);
  }, [alTerminar]);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: espacio.l, right: espacio.l, bottom: 96 }}
    >
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: espacio.m,
        backgroundColor: '#1C1C1A', borderRadius: radio.m,
        paddingVertical: espacio.m, paddingHorizontal: espacio.l, elevation: 6,
      }}>
        <Text style={{ color: '#fff', fontSize: 15, flex: 1 }} numberOfLines={2}>
          {texto}
        </Text>
        <Pressable onPress={alDeshacer} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: '#A5D6A7', fontSize: 15, fontWeight: '700' }}>DESHACER</Text>
        </Pressable>
      </View>
    </View>
  );
}
