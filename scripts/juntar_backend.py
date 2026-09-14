# -*- coding: utf-8 -*-
"""Regenera apps-script/TODO-EN-UNO.gs a partir de los ficheros sueltos."""
import pathlib

BASE = pathlib.Path(__file__).resolve().parent.parent / 'apps-script'
ORDEN = ['tablas.gs', 'acciones.gs', 'agenda.gs', 'custodia.gs', 'menus.gs', 'instalar.gs', 'Codigo.gs']
CABECERA = '''/**
 * 2 CASAS + AMOR — backend completo en un solo fichero.
 *
 * Pega todo esto dentro de "Codigo.gs" en el editor de Apps Script de la hoja
 * (Extensiones → Apps Script), sustituyendo lo que hubiera.
 *
 * Es exactamente el mismo código que los ficheros sueltos de apps-script/,
 * concatenados para que la instalación a mano sea un solo pegado. Cuando el
 * proyecto se suba con clasp, se vuelve a los ficheros separados y este se
 * regenera con scripts/juntar_backend.py.
 *
 * Instrucciones completas: apps-script/LEEME-instalacion.md
 */

'''
partes = [CABECERA]
for nombre in ORDEN:
    cuerpo = (BASE / nombre).read_text(encoding='utf-8').rstrip()
    raya = '// ' + '=' * 70
    partes.append(f'{raya}\n// {nombre}\n{raya}\n\n{cuerpo}\n\n')
(BASE / 'TODO-EN-UNO.gs').write_text('\n'.join(partes), encoding='utf-8')
print('regenerado apps-script/TODO-EN-UNO.gs')
