/**
 * Un día abierto desde Calendario: la misma pantalla que Hoy, con otra fecha.
 */

import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import PantallaDia from '../../src/ui/dia/PantallaDia';

export default function Dia() {
  const { fecha } = useLocalSearchParams<{ fecha: string }>();
  const valida = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha);
  return <PantallaDia fecha={valida ? fecha : undefined} conVolver />;
}
