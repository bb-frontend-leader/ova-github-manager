import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuplicateEntryError } from '../../application/errors';
import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import { SqliteOvaStore, type SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

describe('Estado de las OVAs', () => {
  let store: SqliteProjectStore;
  let schoolId: number;
  let developerId: number;

  const add = (repoName: string, status?: 'development' | 'review' | 'delivered') =>
    store.add({
      repoName,
      repoUrl: `https://github.com/mi-org/${repoName}`,
      schoolId,
      developerId,
      createdBy: 'alejo',
      status,
    });

  beforeEach(async () => {
    store = await openProjectStore();
    const catalog = new ManageCatalogUseCase(store);
    schoolId = (await catalog.addSchool('Ingeniería')).id;
    developerId = (await catalog.addDeveloper('Juan')).id;
  });

  afterEach(() => store.close());

  it('toda OVA nace en desarrollo, con el reloj del estado en su fecha de creación', async () => {
    const ova = await add('GR-1');

    expect(ova.status).toBe('development');
    expect(ova.statusChangedAt).toBe(ova.createdAt);
  });

  it('permite crearla ya en otro estado', async () => {
    expect((await add('GR-1', 'delivered')).status).toBe('delivered');
  });

  it('cambia de estado y reinicia el reloj solo cuando el estado cambia', async () => {
    const ova = await add('GR-1');
    // Se retrocede la marca para notar que el reloj se mueve
    (store as unknown as { db: Database.Database }).db
      .prepare("UPDATE ovas SET status_changed_at = '2020-01-01T00:00:00.000Z' WHERE id = ?")
      .run(ova.id);

    const same = await store.update(ova.id, { status: 'development' });
    expect(same?.statusChangedAt).toBe('2020-01-01T00:00:00.000Z');

    const moved = await store.update(ova.id, { status: 'review' });
    expect(moved?.status).toBe('review');
    expect((moved?.statusChangedAt ?? '') > '2020-01-01T00:00:00.000Z').toBe(true);
  });

  it('cambiar la escuela no toca el estado', async () => {
    const ova = await add('GR-1', 'review');
    const other = await new ManageCatalogUseCase(store).addSchool('Artes');

    const updated = await store.update(ova.id, { schoolId: other.id });

    expect(updated?.status).toBe('review');
  });

  it('no actualiza una OVA que no existe', async () => {
    expect(await store.update(999, { status: 'review' })).toBeNull();
  });

  it('filtra por estado', async () => {
    await add('GR-1');
    await add('GR-2', 'review');
    await add('GR-3', 'review');

    expect((await store.list({ status: 'review' })).map((o) => o.repoName).sort()).toEqual(['GR-2', 'GR-3']);
    expect(await store.list({ status: 'delivered' })).toEqual([]);
  });

  it('cuenta las OVAs por estado, siempre con los tres estados', async () => {
    await add('GR-1');
    await add('GR-2', 'review');
    await add('GR-3', 'review');

    expect((await store.stats()).byStatus).toEqual([
      { status: 'development', count: 1 },
      { status: 'review', count: 2 },
      { status: 'delivered', count: 0 },
    ]);
  });

  it('un estado desconocido en la base se lee como "en desarrollo"', async () => {
    const ova = await add('GR-1');
    const db = (store as unknown as { db: Database.Database }).db;
    db.pragma('ignore_check_constraints = ON');
    db.prepare("UPDATE ovas SET status = 'rara' WHERE id = ?").run(ova.id);
    db.pragma('ignore_check_constraints = OFF');

    expect((await store.findById(ova.id))?.status).toBe('development');
  });

  it('la base rechaza estados inválidos', () => {
    const db = (store as unknown as { db: Database.Database }).db;

    expect(() => db.prepare("UPDATE ovas SET status = 'rara'").run()).not.toThrow(); // sin filas
    expect(() =>
      db
        .prepare(
          `INSERT INTO ovas (project_id, repo_name, repo_url, school_id, developer_id, created_by, status)
           VALUES (?, 'X', 'u', ?, ?, 'a', 'rara')`,
        )
        .run(store.projectId, schoolId, developerId),
    ).toThrow();
  });
});

describe('Usuario de GitHub de cada desarrollador', () => {
  let store: SqliteProjectStore;
  let catalog: ManageCatalogUseCase;

  beforeEach(async () => {
    store = await openProjectStore();
    catalog = new ManageCatalogUseCase(store);
  });

  afterEach(() => store.close());

  it('un desarrollador nuevo no tiene usuario vinculado', async () => {
    expect((await catalog.addDeveloper('Juan')).githubLogin).toBeNull();
  });

  it('se puede vincular al crearlo, normalizando el usuario', async () => {
    const developer = await catalog.addDeveloper('Juan', ' @Juan-Dev ');

    expect(developer.githubLogin).toBe('juan-dev');
    expect(await store.findDeveloperByLogin('JUAN-DEV')).toMatchObject({ id: developer.id });
  });

  it('un texto vacío al crearlo equivale a no vincular', async () => {
    expect((await catalog.addDeveloper('Juan', '   ')).githubLogin).toBeNull();
  });

  it('rechaza un usuario de GitHub inválido', async () => {
    await expect(catalog.addDeveloper('Juan', 'no válido!')).rejects.toThrow('Invalid GitHub username');
  });

  it('vincula, cambia y desvincula después', async () => {
    const { id } = await catalog.addDeveloper('Juan');

    expect((await catalog.linkDeveloper(id, '@Juan')).githubLogin).toBe('juan');
    expect((await catalog.linkDeveloper(id, 'juan2')).githubLogin).toBe('juan2');
    expect((await catalog.linkDeveloper(id, '')).githubLogin).toBeNull();
    expect(await store.findDeveloperByLogin('juan2')).toBeNull();
  });

  it('vincular otra vez el mismo usuario a la misma persona no es un conflicto', async () => {
    const { id } = await catalog.addDeveloper('Juan', 'juan');

    await expect(catalog.linkDeveloper(id, 'JUAN')).resolves.toMatchObject({ githubLogin: 'juan' });
  });

  it('un usuario solo puede estar vinculado a un desarrollador', async () => {
    await catalog.addDeveloper('Juan', 'juan');
    const maria = await catalog.addDeveloper('María');

    await expect(catalog.linkDeveloper(maria.id, 'juan')).rejects.toBeInstanceOf(DuplicateEntryError);
    await expect(catalog.addDeveloper('Pedro', 'juan')).rejects.toThrow('GitHub user already linked: juan');
  });

  it('vincular a un desarrollador que no existe falla', async () => {
    await expect(catalog.linkDeveloper(999, 'juan')).rejects.toThrow('School or developer does not exist');
  });

  it('el usuario vinculado aparece en las OVAs y en las estadísticas', async () => {
    const developer = await catalog.addDeveloper('Juan', 'juan');
    const school = await catalog.addSchool('Ingeniería');
    const ova = await store.add({
      repoName: 'GR-1',
      repoUrl: 'u',
      schoolId: school.id,
      developerId: developer.id,
      createdBy: 'alejo',
    });

    expect(ova.developer.githubLogin).toBe('juan');
    expect((await store.stats()).byDeveloper[0].developer.githubLogin).toBe('juan');
  });

  it('el mismo usuario puede estar vinculado en proyectos distintos', async () => {
    const other = await openProjectStore();
    await catalog.addDeveloper('Juan', 'juan');

    await expect(new ManageCatalogUseCase(other).addDeveloper('Juan', 'juan')).resolves.toBeDefined();
    other.close();
  });
});

describe('Migración de una base creada antes de estas funciones', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ova-migracion-'));
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('añade el estado y el usuario de GitHub sin perder datos, y se puede abrir otra vez', async () => {
    const path = join(dir, 'ova.db');

    // Esquema de la versión anterior: sin status, status_changed_at ni github_login
    const old = new Database(path);
    old.exec(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        org TEXT NOT NULL UNIQUE COLLATE NOCASE, template TEXT NOT NULL, default_team TEXT NOT NULL,
        description_prefix TEXT NOT NULL, total INTEGER NOT NULL CHECK (total > 0),
        created_at TEXT NOT NULL DEFAULT '2026-01-01T00:00:00.000Z');
      CREATE TABLE schools (
        id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id),
        name TEXT NOT NULL COLLATE NOCASE, slug TEXT NOT NULL,
        UNIQUE (project_id, name), UNIQUE (project_id, slug));
      CREATE TABLE developers (
        id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id),
        name TEXT NOT NULL COLLATE NOCASE, UNIQUE (project_id, name));
      CREATE TABLE ovas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id),
        repo_name TEXT NOT NULL COLLATE NOCASE, repo_url TEXT NOT NULL,
        school_id INTEGER NOT NULL REFERENCES schools(id),
        developer_id INTEGER NOT NULL REFERENCES developers(id),
        created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '2026-01-01T00:00:00.000Z',
        UNIQUE (project_id, repo_name));
      INSERT INTO projects (slug, name, org, template, default_team, description_prefix, total)
        VALUES ('p', 'P', 'mi-org', 't', 'frontend', 'OVA', 10);
      INSERT INTO schools (project_id, name, slug) VALUES (1, 'Ingeniería', 'ingenieria');
      INSERT INTO developers (project_id, name) VALUES (1, 'Juan');
      INSERT INTO ovas (project_id, repo_name, repo_url, school_id, developer_id, created_by, created_at)
        VALUES (1, 'GR-1', 'u', 1, 1, 'alejo', '2026-02-03T04:05:06.000Z');
    `);
    old.close();

    const root = new SqliteOvaStore(path);
    const store = root.forProject(1);
    const [ova] = await store.list();

    expect(ova).toMatchObject({
      repoName: 'GR-1',
      status: 'development',
      // Sin fecha propia del estado, cuenta desde la creación
      statusChangedAt: '2026-02-03T04:05:06.000Z',
    });
    expect(ova.developer.githubLogin).toBeNull();
    expect((await store.update(ova.id, { status: 'review' }))?.status).toBe('review');
    expect((await store.setDeveloperLogin(1, 'juan'))?.githubLogin).toBe('juan');
    root.close();

    // Abrirla de nuevo no repite la migración ni pierde lo nuevo
    const again = new SqliteOvaStore(path);
    const [kept] = await again.forProject(1).list();
    expect(kept.status).toBe('review');
    expect(kept.developer.githubLogin).toBe('juan');
    again.close();
  });
});
