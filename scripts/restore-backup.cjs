#!/usr/bin/env node
/**
 * Restaura una copia de seguridad de la base de datos.
 *
 *   node scripts/restore-backup.cjs data/backups/ova-2026-11-06T10-05-09Z.db
 *   node scripts/restore-backup.cjs <copia> --db ./data/ova.db
 *
 * Detén la aplicación antes. La base actual no se borra: se guarda junto a ella como
 * ova.db.antes-de-restaurar-<fecha> (con sus archivos -wal y -shm, si los hay).
 */
const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const dbFlag = args.indexOf('--db');
let target = process.env.DATABASE_PATH || './data/ova.db';
if (dbFlag !== -1) {
  target = args[dbFlag + 1];
  args.splice(dbFlag, 2);
}
const source = args[0];
if (!source || !target) fail('uso: node scripts/restore-backup.cjs <archivo-de-copia> [--db <ruta-de-la-base>]');
if (!fs.existsSync(source)) fail(`no existe la copia "${source}"`);

// Comprobar la copia antes de tocar nada
try {
  const db = new Database(source, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    if (integrity !== 'ok') fail(`la copia está dañada (${integrity})`);
    const hasProjects = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'projects'").get();
    if (!hasProjects) fail('el archivo no parece una base de datos de OVA GitHub Manager');
  } finally {
    db.close();
  }
} catch (error) {
  fail(`no se pudo leer la copia: ${error.message}`);
}

fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });

const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
for (const suffix of ['', '-wal', '-shm']) {
  const file = target + suffix;
  if (fs.existsSync(file)) fs.renameSync(file, `${target}.antes-de-restaurar-${stamp}${suffix}`);
}
fs.copyFileSync(source, target);

console.log(`Restaurada ${source} en ${target}.`);
if (fs.existsSync(`${target}.antes-de-restaurar-${stamp}`)) {
  console.log(`La base anterior quedó en ${target}.antes-de-restaurar-${stamp}`);
}
