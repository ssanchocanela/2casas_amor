/**
 * El teclado de Android, medido.
 *
 * Las hojas que suben desde abajo son un `Modal`, y la ventana de un Modal
 * translúcido no la redimensiona Android al abrir el teclado: el teclado se
 * planta encima de lo que estás escribiendo. Así que se mide y se aparta a
 * mano.
 *
 * Devuelve 0 con el teclado cerrado. Lo que tapa entonces es la barra de
 * navegación del sistema, y de eso se encarga el hueco de las zonas seguras.
 */

import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

export function useAlturaTeclado() {
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    // En Android solo llegan los eventos 'Did'; los 'Will' son de iOS.
    const abre = Keyboard.addListener('keyboardDidShow', (e) => setAlto(e.endCoordinates.height));
    const cierra = Keyboard.addListener('keyboardDidHide', () => setAlto(0));
    return () => { abre.remove(); cierra.remove(); };
  }, []);

  return alto;
}
