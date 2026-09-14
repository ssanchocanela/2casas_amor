/**
 * La base SQLite del móvil. Una sola, con tres tablas:
 *   · cola:      escrituras pendientes de subir (cola.ts). Esto sí es un dato:
 *                no se vacía sin que el backend lo haya aceptado.
 *   · recuerdos: respuestas enteras y preferencias pequeñas (cache.ts).
 *   · filas:     filas sueltas de las pestañas, por fecha (cache.ts).
 * Las dos últimas son caché: se pueden vaciar y se vuelven a llenar solas.
 */

import * as SQLite from 'expo-sqlite';

let bd: SQLite.SQLiteDatabase | null = null;

export function base() {
  if (!bd) {
    bd = SQLite.openDatabaseSync('doscasas.db');
    bd.execSync(`
      CREATE TABLE IF NOT EXISTS cola (
        id_local    TEXT PRIMARY KEY,
        accion      TEXT NOT NULL,
        tabla       TEXT NOT NULL,
        registro_id TEXT NOT NULL,
        datos       TEXT NOT NULL,
        creado_en   TEXT NOT NULL,
        intentos    INTEGER NOT NULL DEFAULT 0,
        error       TEXT
      );
      CREATE TABLE IF NOT EXISTS recuerdos (
        clave       TEXT PRIMARY KEY,
        valor       TEXT NOT NULL,
        guardado_en TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS filas (
        tabla   TEXT NOT NULL,
        id      TEXT NOT NULL,
        fecha   TEXT NOT NULL DEFAULT '',
        nino_id TEXT NOT NULL DEFAULT '',
        datos   TEXT NOT NULL,
        PRIMARY KEY (tabla, id)
      );
      CREATE INDEX IF NOT EXISTS filas_por_fecha ON filas (tabla, fecha);
      -- Claves de la primera versión, sustituidas por la caché de filas.
      DELETE FROM recuerdos WHERE clave = 'agenda_hoy' OR clave LIKE 'semana_%';
    `);
  }
  return bd;
}
