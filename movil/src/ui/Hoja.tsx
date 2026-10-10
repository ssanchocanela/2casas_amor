/**
 * LA HOJA QUE SUBE DESDE ABAJO.
 *
 * La usan Apuntar y las fichas (tareas, lecturas, eventos). Aquí está, en un
 * solo sitio, lo que cuesta acertar: que el teclado no tape lo que escribes
 * (ver `teclado.ts`), que el contenido no quede debajo de la barra de
 * navegación de Android y que al tocar un campo se le lleve arriba.
 *
 * Fuera de aquí, los campos son tontos: se declaran y ya.
 */

import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, ScrollView, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlturaTeclado } from './teclado';
import { color, espacio, letra, radio } from './tema';

/** Cada campo de texto se señala al enfocarse para que se le vea. */
const Enfoque = createContext<(entrada: TextInput | null) => void>(() => {});

export default function Hoja({ visible, alCerrar, alAtras, children }: {
  visible: boolean;
  alCerrar: () => void;
  /** El botón físico de atrás. Si no se pasa, cierra. */
  alAtras?: () => void;
  children: React.ReactNode;
}) {
  const teclado = useAlturaTeclado();
  const { bottom } = useSafeAreaInsets();
  // Lo que hay que dejar libre debajo del contenido: el teclado si está
  // abierto y, si no, la barra de navegación de Android.
  const abajo = teclado > 0 ? teclado : bottom;
  const scroll = useRef<ScrollView>(null);
  const contenido = useRef<View>(null);
  const foco = useRef(0);

  // Se mide contra el contenido del scroll y no contra el padre del campo:
  // dentro de un formulario los campos van envueltos en filas, y la 'y' que
  // da onLayout sería la del envoltorio.
  const aLaVista = useCallback((entrada: TextInput | null) => {
    const lista = scroll.current;
    if (!entrada || !lista) return;
    if (!contenido.current) return;
    entrada.measureLayout(
      contenido.current,
      (_x, y) => {
        foco.current = y;
        lista.scrollTo({ y: Math.max(0, y - espacio.m), animated: true });
      },
      () => {},
    );
  }, []);

  // Al abrirse el teclado la hoja se encoge: el campo que se está escribiendo
  // vuelve a subir.
  useEffect(() => {
    if (teclado > 0) scroll.current?.scrollTo({ y: Math.max(0, foco.current - espacio.m), animated: true });
  }, [teclado]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={alAtras ?? alCerrar}
    >
      <Enfoque.Provider value={aLaVista}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} onPress={alCerrar} />
          <View style={{
            backgroundColor: color.fondo, maxHeight: '92%',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
          }}>
            <View style={{
              alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
              backgroundColor: color.borde, marginTop: espacio.s,
            }} />
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: espacio.l, paddingBottom: espacio.xxl + abajo }}
            >
              {/* Contra esta vista se mide el campo enfocado. */}
              <View ref={contenido} collapsable={false}>{children}</View>
            </ScrollView>
          </View>
        </View>
      </Enfoque.Provider>
    </Modal>
  );
}

export function Cabecera({ alVolver, children }: { alVolver: () => void; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espacio.s }}>
      <Pressable onPress={alVolver} hitSlop={12} accessibilityLabel="Volver">
        <Text style={{ fontSize: 26, color: color.textoSuave }}>‹</Text>
      </Pressable>
      <Text style={[letra.titulo, { fontSize: 22, flexShrink: 1 }]}>{children}</Text>
    </View>
  );
}

export function BotonGuardar({ activo, alTocar, texto = 'Guardar' }: {
  activo: boolean; alTocar: () => void; texto?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={!activo}
      style={{
        marginTop: espacio.l, borderRadius: radio.m, paddingVertical: espacio.l, alignItems: 'center',
        backgroundColor: activo ? color.acento : color.borde,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '700', color: activo ? '#fff' : color.textoTenue }}>{texto}</Text>
    </Pressable>
  );
}

export function Campo({ etiqueta, valor, alCambiar, ayuda, multilinea, numerico }: {
  etiqueta: string; valor: string; alCambiar: (t: string) => void;
  ayuda?: string; multilinea?: boolean; numerico?: boolean;
}) {
  const aLaVista = useContext(Enfoque);
  const entrada = useRef<TextInput>(null);
  return (
    <View style={{ marginBottom: espacio.m }}>
      <Text style={[letra.seccion, { marginBottom: espacio.xs }]}>{etiqueta.toUpperCase()}</Text>
      <TextInput
        ref={entrada}
        value={valor}
        onChangeText={alCambiar}
        onFocus={() => aLaVista(entrada.current)}
        placeholder={ayuda}
        placeholderTextColor={color.textoTenue}
        multiline={multilinea}
        keyboardType={numerico ? 'numeric' : 'default'}
        style={{
          backgroundColor: color.tarjeta, borderWidth: 1, borderColor: color.borde,
          borderRadius: radio.m, padding: espacio.m, fontSize: 16, color: color.texto,
          minHeight: multilinea ? 80 : undefined, textAlignVertical: multilinea ? 'top' : 'center',
        }}
      />
    </View>
  );
}
