/**
 * Pantalla de conexión. Se ve una sola vez, al instalar la app en un móvil.
 *
 * Pide la dirección de la implementación del Apps Script y el token de quien
 * va a usar este teléfono. Nada de esto se escribe en el código ni sale del
 * móvil: se guarda en el Keystore de Android.
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSesion } from '../src/estado/sesion';
import { ErrorApi } from '../src/api/cliente';
import { color, espacio, letra, radio } from '../src/ui/tema';

export default function Conexion() {
  const { entrar } = useSesion();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [probando, setProbando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listo = url.trim().length > 20 && token.trim().length > 20;

  async function conectar() {
    setProbando(true);
    setError(null);
    try {
      await entrar({ url: url.trim(), token: token.trim() });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se ha podido conectar.');
    } finally {
      setProbando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: color.fondo }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: espacio.xl, paddingTop: 72 }}>
        <Text style={letra.titulo}>2 Casas + Amor</Text>
        <Text style={[letra.suave, { marginTop: espacio.s, marginBottom: espacio.xl }]}>
          Para empezar, conecta este móvil con vuestra hoja.
        </Text>

        <Campo
          etiqueta="Dirección del backend"
          ayuda="La URL que dio Google al implementar el script. Termina en /exec"
          valor={url}
          alCambiar={setUrl}
          marcador="https://script.google.com/macros/s/.../exec"
          autoCapitalize="none"
        />

        <Campo
          etiqueta="Tu token"
          ayuda="El que generó la función generarTokens. Cada persona tiene el suyo."
          valor={token}
          alCambiar={setToken}
          marcador="a1b2c3..."
          secreto
          autoCapitalize="none"
        />

        {error && (
          <View style={{
            backgroundColor: '#FDECEA', borderRadius: radio.m,
            padding: espacio.m, marginTop: espacio.m,
          }}>
            <Text style={{ color: color.error, fontSize: 14 }}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={conectar}
          disabled={!listo || probando}
          style={{
            backgroundColor: listo ? color.acento : color.borde,
            borderRadius: radio.m,
            paddingVertical: espacio.l,
            alignItems: 'center',
            marginTop: espacio.xl,
          }}
        >
          {probando
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: listo ? '#fff' : color.textoTenue, fontWeight: '600', fontSize: 16 }}>
                Conectar
              </Text>}
        </Pressable>

        <Text style={[letra.tenue, { marginTop: espacio.xl, lineHeight: 19 }]}>
          El token se guarda en el almacén seguro del móvil. Si pierdes el teléfono,
          basta con volver a ejecutar generarTokens en el script: el token viejo deja
          de valer al instante.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Campo({ etiqueta, ayuda, valor, alCambiar, marcador, secreto, ...resto }: any) {
  return (
    <View style={{ marginBottom: espacio.l }}>
      <Text style={[letra.seccion, { marginBottom: espacio.xs }]}>
        {etiqueta.toUpperCase()}
      </Text>
      <TextInput
        value={valor}
        onChangeText={alCambiar}
        placeholder={marcador}
        placeholderTextColor={color.textoTenue}
        secureTextEntry={secreto}
        autoCorrect={false}
        style={{
          backgroundColor: color.tarjeta,
          borderWidth: 1,
          borderColor: color.borde,
          borderRadius: radio.m,
          padding: espacio.m,
          fontSize: 15,
          color: color.texto,
        }}
        {...resto}
      />
      <Text style={[letra.tenue, { marginTop: espacio.xs }]}>{ayuda}</Text>
    </View>
  );
}
