import Database from 'better-sqlite3';
import { mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { BackupSnapshot, DatabaseBackup } from '../../application/BackupUseCase';

/** Nombre: ova-2026-11-06T13-05-00Z.db (UTC, sin ":" para que sea válido también en Windows). */
const NAME = /^ova-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.db$/;

export function backupFileName(date: Date): string {
  return `ova-${date.toISOString().slice(0, 19).replace(/:/g, '-')}Z.db`;
}

/** Fecha que dice el nombre de una copia, o null si el archivo no es una copia nuestra. */
export function parseBackupName(name: string): Date | null {
  const match = NAME.exec(name);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Comprueba que un archivo es una base SQLite legible y sin daños. Lanza si no lo es.
 * Con `standalone` la deja como un único archivo (sin -wal ni -shm): una copia hecha desde una
 * base en modo WAL conserva ese modo y, abierta sola, crearía archivos auxiliares. No lo uses
 * sobre una base en uso.
 */
export function verifyDatabaseFile(path: string, options: { standalone?: boolean } = {}): void {
  const db = new Database(path, { readonly: !options.standalone, fileMustExist: true });
  try {
    if (options.standalone) db.pragma('journal_mode = DELETE');
    const result = db.pragma('integrity_check', { simple: true });
    if (result !== 'ok') throw new Error(`Backup is corrupt: ${String(result)}`);
    // Que además tenga el esquema de la herramienta, no una base cualquiera
    const hasProjects = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'projects'")
      .get();
    if (!hasProjects) throw new Error('Backup does not look like an OVA database');
  } finally {
    db.close();
  }
}

/**
 * Copias de la base en una carpeta, hechas con la API de respaldo de SQLite: son consistentes
 * aunque la base esté en uso y en modo WAL (copiar el archivo a mano no lo garantiza).
 */
export class SqliteDatabaseBackup implements DatabaseBackup {
  constructor(
    /** Hace la copia en la ruta indicada (p. ej. `store.backupTo`) */
    private readonly copyTo: (destination: string) => Promise<void>,
    private readonly dir: string,
  ) {}

  async create(now: Date): Promise<BackupSnapshot> {
    mkdirSync(this.dir, { recursive: true });
    const name = backupFileName(now);
    const finalPath = join(this.dir, name);
    // Se escribe con otro nombre y se renombra al final: nunca queda una copia a medias con nombre válido
    const partial = `${finalPath}.partial`;
    try {
      await this.copyTo(partial);
      verifyDatabaseFile(partial, { standalone: true });
      renameSync(partial, finalPath);
    } catch (error) {
      rmSync(partial, { force: true });
      throw error;
    }
    return { name, createdAt: now.toISOString(), sizeBytes: statSync(finalPath).size };
  }

  async list(): Promise<BackupSnapshot[]> {
    let names: string[];
    try {
      names = readdirSync(this.dir);
    } catch {
      return []; // la carpeta aún no existe: todavía no hay copias
    }
    const snapshots: BackupSnapshot[] = [];
    for (const name of names) {
      const date = parseBackupName(name);
      if (!date) continue; // solo se tocan archivos con nuestro formato
      snapshots.push({
        name,
        createdAt: date.toISOString(),
        sizeBytes: statSync(join(this.dir, name)).size,
      });
    }
    return snapshots.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async prune(keep: number): Promise<string[]> {
    const removed: string[] = [];
    for (const snapshot of (await this.list()).slice(Math.max(0, keep))) {
      rmSync(join(this.dir, snapshot.name), { force: true });
      removed.push(snapshot.name);
    }
    return removed;
  }
}
