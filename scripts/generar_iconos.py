# -*- coding: utf-8 -*-
"""Genera los iconos de la app para Android: las dos casas y el sol.

Es el dibujo de movil/assets/diseno/prueba-iconos.png, pero trazado aquí en
vectorial para sacar cada pieza al tamaño que pide Android sin pixelar. La casa
verde y la morada llevan los colores de papá y mamá de la pestaña 'personas'.

    python scripts/generar_iconos.py        (necesita Pillow)

Escribe en movil/assets/images/:
    icon.png                     1024  icono completo, con fondo
    android-icon-background.png  1024  fondo del icono adaptable
    android-icon-foreground.png  1024  dibujo del icono adaptable, dentro de la zona segura
    android-icon-monochrome.png  1024  silueta para los iconos temáticos de Android 13+
    splash-icon.png               512  dibujo de la pantalla de carga
"""

import os
from PIL import Image, ImageChops, ImageDraw

SALIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'movil', 'assets', 'images')

VERDE, MORADO, SOL = (46, 125, 50), (106, 27, 154), (243, 201, 139)
PUERTA_VERDE, PUERTA_MORADA = (221, 214, 190), (230, 208, 218)
FONDO_ARRIBA, FONDO_ABAJO = (251, 238, 221), (245, 232, 218)

SOBREMUESTREO = 4

# Coordenadas sobre un lienzo de 1 × 1, medidas en la maqueta del icono.
CASA_VERDE = dict(tejado=[(.259, .509), (.406, .400), (.540, .509)],
                  cuerpo=(.290, .509, .540, .688), puerta=(.375, .597, .438, .688))
CASA_MORADA = dict(tejado=[(.456, .572), (.569, .491), (.682, .572)],
                   cuerpo=(.475, .572, .662, .709), puerta=(.544, .634, .594, .709))
SOL_CENTRO, SOL_RADIO = (.6875, .328), .053
HUECO = .012  # la línea clara que separa la casa morada de la verde


def contorno(casa):
    (x1, y), cumbre, (x2, _) = casa['tejado']
    izq, _, der, abajo = casa['cuerpo']
    return [(x1, y), cumbre, (x2, y), (der, y), (der, abajo), (izq, abajo), (izq, y)]


def dibujo(lado, escala=1.0, monocromo=False):
    """Las casas y el sol sobre transparente. 'escala' encoge alrededor del centro."""
    n = lado * SOBREMUESTREO

    def punto(x, y):
        return ((.5 + (x - .5) * escala) * n, (.5 + (y - .5) * escala) * n)

    def tinta(rgb):
        return (255, 255, 255, 255) if monocromo else rgb + (255,)

    def casa(d, datos, rgb, puerta_rgb):
        d.polygon([punto(*q) for q in contorno(datos)], fill=tinta(rgb))
        izq, arriba, der, abajo = datos['puerta']
        (x1, y1), (x2, y2) = punto(izq, arriba), punto(der, abajo)
        r = (x2 - x1) / 2
        # En la silueta, la puerta es un hueco.
        relleno = (0, 0, 0, 0) if monocromo else puerta_rgb + (255,)
        d.rounded_rectangle((x1, y1, x2, y2), radius=r, fill=relleno)
        d.rectangle((x1, y1 + r, x2, y2), fill=relleno)

    capa = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    sx, sy = punto(*SOL_CENTRO)
    r = SOL_RADIO * escala * n
    d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=tinta(SOL))
    casa(d, CASA_VERDE, VERDE, PUERTA_VERDE)

    # Hueco alrededor de la casa morada: se recorta lo que haya debajo.
    mascara = Image.new('L', (n, n), 0)
    ImageDraw.Draw(mascara).polygon(
        [punto(*q) for q in contorno(CASA_MORADA)], fill=255, outline=255,
        width=max(1, int(HUECO * escala * n * 2)))
    capa.putalpha(ImageChops.subtract(capa.getchannel('A'), mascara))

    casa(ImageDraw.Draw(capa), CASA_MORADA, MORADO, PUERTA_MORADA)
    return capa.resize((lado, lado), Image.LANCZOS)


def fondo(lado):
    img = Image.new('RGBA', (lado, lado))
    d = ImageDraw.Draw(img)
    for y in range(lado):
        t = y / (lado - 1)
        d.line([(0, y), (lado, y)],
               fill=tuple(round(a + (b - a) * t) for a, b in zip(FONDO_ARRIBA, FONDO_ABAJO)) + (255,))
    return img


def guardar(img, nombre):
    ruta = os.path.join(SALIDA, nombre)
    img.save(ruta, optimize=True)
    print('escrito', os.path.relpath(ruta), img.size)


# El icono adaptable de Android recorta el dibujo con la forma del lanzador:
# solo el círculo central de 2/3 es seguro, de ahí el 0.8.
guardar(Image.alpha_composite(fondo(1024), dibujo(1024)), 'icon.png')
guardar(fondo(1024), 'android-icon-background.png')
guardar(dibujo(1024, escala=.8), 'android-icon-foreground.png')
guardar(dibujo(1024, escala=.8, monocromo=True), 'android-icon-monochrome.png')
guardar(dibujo(512), 'splash-icon.png')
