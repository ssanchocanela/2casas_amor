import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { color } from '../../src/ui/tema';

/**
 * Cuatro pestañas: Hoy · Calendario · Niños · Ajustes.
 * Los iconos son emoji a propósito: una dependencia menos que mantener, y en
 * una app familiar de dos usuarios no compensa el paquete de iconos.
 */
export default function Pestanas() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.acento,
        tabBarInactiveTintColor: color.textoTenue,
        tabBarStyle: { backgroundColor: color.tarjeta, borderTopColor: color.borde },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoy', tabBarIcon: icono('☀️') }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendario', tabBarIcon: icono('📅') }} />
      <Tabs.Screen name="ninos" options={{ title: 'Niños', tabBarIcon: icono('🧒') }} />
      <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: icono('⚙️') }} />
    </Tabs>
  );
}

const icono = (emoji: string) => () => <Text style={{ fontSize: 18 }}>{emoji}</Text>;
