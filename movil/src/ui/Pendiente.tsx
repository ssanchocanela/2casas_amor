import React from 'react';
import { View, Text } from 'react-native';
import { color, espacio, letra, radio } from './tema';

/**
 * Marcador de pantalla por construir. Existe para que la barra de pestañas
 * esté completa desde el primer día y se vea el esqueleto entero de la app.
 * Se borra en cuanto la pantalla real ocupe su sitio.
 */
export default function Pendiente({ titulo, texto, siguiente }: {
  titulo: string; texto: string; siguiente: string;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: color.fondo, padding: espacio.l, paddingTop: 56 }}>
      <Text style={letra.titulo}>{titulo}</Text>
      <Text style={[letra.suave, { marginTop: espacio.s }]}>{texto}</Text>
      <View style={{
        marginTop: espacio.xl, backgroundColor: color.tarjeta,
        borderRadius: radio.m, borderWidth: 1, borderColor: color.borde,
        padding: espacio.m,
      }}>
        <Text style={[letra.seccion, { marginBottom: espacio.xs }]}>POR CONSTRUIR</Text>
        <Text style={letra.tenue}>{siguiente}</Text>
      </View>
    </View>
  );
}
