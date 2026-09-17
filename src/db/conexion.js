import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const ESQUEMA = path.join(path.dirname(fileURLToPath(import.meta.url)), 'esquema.sql');

// Abre la base y aplica el esquema. Es idempotente: se puede llamar en cada
// arranque porque el esquema usa CREATE ... IF NOT EXISTS.
export function abreDb(ruta = config.rutaDb) {
  if (ruta !== ':memory:') {
    mkdirSync(path.dirname(ruta), { recursive: true });
  }
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(readFileSync(ESQUEMA, 'utf8'));
  return db;
}
