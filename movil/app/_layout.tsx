import React from 'react';
import { Stack, Redirect, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ProveedorSesion, useSesion } from '../src/estado/sesion';
import { ProveedorCola } from '../src/estado/cola';
import { color } from '../src/ui/tema';

function Puerta() {
  const { cargando, credenciales } = useSesion();
  const segmentos = useSegments();
  const enConexion = segmentos[0] === 'conexion';

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: color.fondo }}>
        <ActivityIndicator color={color.acento} />
      </View>
    );
  }

  // Sin credenciales no se entra a ningún sitio más que a la pantalla de conexión.
  if (!credenciales && !enConexion) return <Redirect href="/conexion" />;
  if (credenciales && enConexion) return <Redirect href="/" />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.fondo } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="conexion" />
      <Stack.Screen name="dia/[fecha]" />
      <Stack.Screen name="menu/[mes]" />
    </Stack>
  );
}

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        <ProveedorCola>
          <StatusBar style="dark" />
          <Puerta />
        </ProveedorCola>
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}
