import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BackupUseCase } from '../../application/BackupUseCase';
import {
  SqliteDatabaseBackup,
  SqliteOvaStore,
  backupFileName,
  parseBackupName,
  verifyDatabaseFile,
} from '../../infrastructure/sqlite';

const HOUR = 60 * 60 * 1000;
const T0 = new Date('2026-11-06T10:05:09.000Z');
const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);

describe('nombres de las copias', () => {
  it('se generan en UTC y sin ":" (válidos en Windows)', () => {
    expect(backupFileName(T0)).toBe('ova-2026-11-06T10-05-09Z.db');
  });

  it('se pueden leer de vuelta', () => {
    expect(parseBackupName(backupFileName(T0))?.toISOString()).toBe(T0.toISOString());
  });

  it.each([
    'ova.db',
    'ova.db-wal',
    'ova-2026-11-06T10-05-09Z.db.partial',
    'otro-2026-11-06T10-05-09Z.db',
    'ova-2026-13-45T99-99-99Z.db',
    'notas.txt',
  ])('no reconoce "%s" como una copia', (name) => {
    expect(parseBackupName(name)).toBeNull();
  });
});

describe('copias de seguridad en SQLite', () => {
  let dir: string;
  let dbPath: string;
  let store: SqliteOvaStore;
  let backupDir: string;
  let backup: SqliteDatabaseBackup;

  const projectNames = async (path: string) => {
    const copy = new SqliteOvaStore(path);
    const names = (await copy.listProjects()).map((p) => p.name);
    copy.close();
    return names;
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'ova-backup-'));
    dbPath = join(dir, 'ova.db');
    backupDir = join(dir, 'backups');
    store = new SqliteOvaStore(dbPath);
    await store.createProject({
      slug: 'uno',
      name: 'Proyecto uno',
      org: 'org-uno',
      template: 't',
      defaultTeam: 'frontend',
      descriptionPrefix: 'OVA',
      total: 5,
    });
    backup = new SqliteDatabaseBackup((destination) => store.backupTo(destination), backupDir);
  });

  afterEach(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('crea la carpeta y una copia con los mismos datos', async () => {
    const snapshot = await backup.create(T0);

    expect(snapshot).toMatchObject({ name: 'ova-2026-11-06T10-05-09Z.db', createdAt: T0.toISOString() });
    expect(snapshot.sizeBytes).toBeGreaterThan(0);
    expect(await projectNames(join(backupDir, snapshot.name))).toEqual(['Proyecto uno']);
  });

  it('incluye lo que aún está en el WAL de una base en uso', async () => {
    // Con la base abierta en modo WAL, lo último escrito puede no estar aún en el archivo principal
    await store.createProject({
      slug: 'dos',
      name: 'Proyecto dos',
      org: 'org-dos',
      template: 't',
      defaultTeam: 'frontend',
      descriptionPrefix: 'OVA',
      total: 5,
    });

    const snapshot = await backup.create(T0);

    expect((await projectNames(join(backupDir, snapshot.name))).sort()).toEqual([
      'Proyecto dos',
      'Proyecto uno',
    ]);
  });

  it('la copia es un solo archivo, sin -wal ni -shm ni temporales', async () => {
    await backup.create(T0);

    expect(readdirSync(backupDir)).toEqual(['ova-2026-11-06T10-05-09Z.db']);
  });

  it('la copia no se ve afectada por lo que se escriba después', async () => {
    const snapshot = await backup.create(T0);
    await store.createProject({
      slug: 'tres',
      name: 'Proyecto tres',
      org: 'org-tres',
      template: 't',
      defaultTeam: 'frontend',
      descriptionPrefix: 'OVA',
      total: 5,
    });

    expect(await projectNames(join(backupDir, snapshot.name))).toEqual(['Proyecto uno']);
  });

  it('lista las copias de la más reciente a la más antigua e ignora otros archivos', async () => {
    await backup.create(at(0));
    await backup.create(at(2));
    await backup.create(at(1));
    writeFileSync(join(backupDir, 'notas.txt'), 'no tocar');
    writeFileSync(join(backupDir, 'ova-2026-11-06T10-05-09Z.db.partial'), 'a medias');

    const list = await backup.list();

    expect(list.map((s) => s.createdAt)).toEqual([at(2), at(1), at(0)].map((d) => d.toISOString()));
  });

  it('sin carpeta todavía, no hay copias', async () => {
    expect(await backup.list()).toEqual([]);
  });

  it('la retención borra solo las copias más antiguas y respeta otros archivos', async () => {
    for (let i = 0; i < 4; i++) await backup.create(at(i));
    writeFileSync(join(backupDir, 'notas.txt'), 'no tocar');

    const removed = await backup.prune(2);

    expect(removed).toEqual([backupFileName(at(1)), backupFileName(at(0))]);
    expect((await backup.list()).map((s) => s.name)).toEqual([backupFileName(at(3)), backupFileName(at(2))]);
    expect(existsSync(join(backupDir, 'notas.txt'))).toBe(true);
  });

  it('podar con un límite mayor que las copias existentes no borra nada', async () => {
    await backup.create(at(0));

    expect(await backup.prune(5)).toEqual([]);
    expect(await backup.prune(-1)).toHaveLength(1); // un límite absurdo se trata como 0
  });

  it('si la copia falla no deja archivos a medias y el error llega a quien llama', async () => {
    const failing = new SqliteDatabaseBackup(async (destination) => {
      writeFileSync(destination, 'basura que no es SQLite');
    }, backupDir);

    await expect(failing.create(T0)).rejects.toThrow();

    expect(readdirSync(backupDir)).toEqual([]);
  });

  it('rechaza una "copia" que no es una base de la herramienta', async () => {
    const other = new SqliteDatabaseBackup(async (destination) => {
      const db = new Database(destination);
      db.exec('CREATE TABLE otra_cosa (x INTEGER)');
      db.close();
    }, backupDir);

    await expect(other.create(T0)).rejects.toThrow('does not look like an OVA database');
    expect(readdirSync(backupDir)).toEqual([]);
  });

  describe('verifyDatabaseFile', () => {
    it('acepta una base válida sin modificarla', async () => {
      await backup.create(T0);
      const path = join(backupDir, backupFileName(T0));

      expect(() => verifyDatabaseFile(path)).not.toThrow();
    });

    it('rechaza un archivo que no existe', () => {
      expect(() => verifyDatabaseFile(join(dir, 'no-existe.db'))).toThrow();
    });

    it('rechaza un archivo que no es SQLite', () => {
      const path = join(dir, 'falso.db');
      writeFileSync(path, 'esto no es una base de datos '.repeat(50));

      expect(() => verifyDatabaseFile(path)).toThrow();
    });
  });

  it('funciona de punta a punta con el caso de uso: copia, vuelve a copiar solo si toca y poda', async () => {
    const useCase = new BackupUseCase(backup, { intervalMs: 24 * HOUR, keep: 2 });

    await useCase.runIfDue(at(0));
    expect(await useCase.runIfDue(at(1))).toBeNull();
    await useCase.runIfDue(at(25));
    await useCase.runIfDue(at(50));

    const status = await useCase.status();
    expect(status.snapshots.map((s) => s.createdAt)).toEqual([at(50), at(25)].map((d) => d.toISOString()));
    expect(readdirSync(backupDir)).toHaveLength(2);
  });
});
