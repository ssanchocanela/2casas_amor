import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { color, espacio, radio } from './tema';

/** Elegir una opción entre pocas (Niño1, Niña2, los dos), cada una en su color. */
export default function Segmento({ opciones, valor, alCambiar }: {
  opciones: { valor: string; texto: string; tono: string }[];
  valor: string;
  alCambiar: (v: string) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#ECEBE6', borderRadius: radio.m, padding: 4 }}>
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => alCambiar(o.valor)}
            accessibilityRole="button"
            accessibilityState={{ selected: activa }}
            style={{
              flex: 1, alignItems: 'center', paddingVertical: espacio.s + 2, borderRadius: radio.s,
              backgroundColor: activa ? color.tarjeta : 'transparent', elevation: activa ? 1 : 0,
            }}
          >
            <Text style={{
              fontSize: 15, fontWeight: activa ? '700' : '500',
              color: activa ? o.tono : color.textoSuave,
            }}>
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
