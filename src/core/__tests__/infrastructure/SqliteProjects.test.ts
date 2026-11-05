import Database from 'better-sqlite3';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuplicateEntryError } from '../../application/errors';
import type { ProjectDetails } from '../../domain/Project';
import { SqliteOvaStore } from '../../infrastructure/sqlite';

const details = (slug: string, org: string): ProjectDetails => ({
  slug,
  name: slug,
  org,
  template: 'ova-template',
  defaultTeam: 'Frontend',
  descriptionPrefix: slug,
  total: 10,
});

describe('SqliteOvaStore · proyectos', () => {
  let root: SqliteOvaStore;

  beforeEach(() => {
    root = new SqliteOvaStore(':memory:');
  });
  afterEach(() => root.close());

  it('crea, busca y lista proyectos', async () => {
    const a = await root.createProject(details('alpha', 'org-a'));
    await root.createProject(details('beta', 'org-b'));

    expect(a).toMatchObject({ slug: 'alpha', org: 'org-a', total: 10 });
    expect(await root.findProject('alpha')).toEqual(a);
    expect(await root.findProjectById(a.id)).toEqual(a);
    expect(await root.findProject('nope')).toBeNull();
    expect(await root.findProjectById(99)).toBeNull();
    expect((await root.listProjects()).map((p) => p.slug)).toEqual(['alpha', 'beta']);
  });

  it('rechaza organización o identificador repetidos (la organización sin distinguir mayúsculas)', async () => {
    await root.createProject(details('alpha', 'org-a'));

    await expect(root.createProject(details('otro', 'ORG-A'))).rejects.toThrow(
      'Organization already registered: ORG-A',
    );
    await expect(root.createProject(details('alpha', 'org-z'))).rejects.toThrow(
      'Project already exists: alpha',
    );
    await expect(root.createProject(details('alpha', 'org-z'))).rejects.toBeInstanceOf(
      DuplicateEntryError,
    );
  });

  it('actualiza solo los campos indicados', async () => {
    const a = await root.createProject(details('alpha', 'org-a'));

    const updated = await root.updateProject(a.id, { name: 'Nuevo', total: 99 });

    expect(updated).toMatchObject({ name: 'Nuevo', total: 99, template: 'ova-template', org: 'org-a' });
    expect(await root.updateProject(a.id, {})).toEqual(updated);
    expect(await root.updateProject(999, { name: 'x' })).toBeNull();
  });

  it('lo de un proyecto no se mezcla con lo de otro', async () => {
    const a = root.forProject((await root.createProject(details('alpha', 'org-a'))).id);
    const b = root.forProject((await root.createProject(details('beta', 'org-b'))).id);

    // El mismo nombre puede existir en proyectos distintos
    const schoolA = await a.addSchool({ name: 'Ingeniería', slug: 'ingenieria' });
    const schoolB = await b.addSchool({ name: 'Ingeniería', slug: 'ingenieria' });
    const devA = await a.addDeveloper({ name: 'Juan' });
    const devB = await b.addDeveloper({ name: 'Juan' });
    await a.createUser('ana', 'admin');
    const ovaA = await a.add({
      repoName: 'ova-1',
      repoUrl: 'https://x/a',
      schoolId: schoolA.id,
      developerId: devA.id,
      createdBy: 'ana',
    });
    await a.record({ actor: 'ana', action: 'ova.created', repoName: 'ova-1', repoUrl: 'u', details: {} });

    expect(await a.list()).toHaveLength(1);
    expect(await b.list()).toEqual([]);
    expect(await b.findByRepoName('ova-1')).toBeNull();
    expect(await b.findById(ovaA.id)).toBeNull();
    expect(await b.findSchool(schoolA.id)).toBeNull();
    expect(await b.findDeveloper(devA.id)).toBeNull();
    expect(await b.findUser('ana')).toBeNull();
    expect((await b.stats()).total).toBe(0);
    expect((await b.listActivity({}, 10, 0)).total).toBe(0);
    expect((await a.listActivity({}, 10, 0)).total).toBe(1);

    // Cada proyecto puede tener una OVA con el mismo nombre de repositorio
    await b.add({ repoName: 'ova-1', repoUrl: 'https://x/b', schoolId: schoolB.id, developerId: devB.id, createdBy: 'x' });

    // No se pueden cruzar escuela ni desarrollador de otro proyecto
    await expect(
      b.add({ repoName: 'ova-2', repoUrl: 'u', schoolId: schoolA.id, developerId: devB.id, createdBy: 'x' }),
    ).rejects.toThrow('School or developer does not exist');
    await expect(
      b.add({ repoName: 'ova-2', repoUrl: 'u', schoolId: schoolB.id, developerId: devA.id, createdBy: 'x' }),
    ).rejects.toThrow('School or developer does not exist');
    const ovaB = (await b.findByRepoName('ova-1'))!;
    await expect(b.update(ovaB.id, { schoolId: schoolA.id })).rejects.toThrow('does not exist');

    // Ni actuar sobre las OVAs del otro
    expect(await b.update(ovaA.id, { developerId: devB.id })).toBeNull();
    expect(await b.remove(ovaA.id)).toBe(false);
    expect(await a.findById(ovaA.id)).not.toBeNull();
  });

  it('los miembros se verifican por proyecto', async () => {
    const a = await root.createProject(details('alpha', 'org-a'));
    const b = await root.createProject(details('beta', 'org-b'));
    await root.forProject(b.id).createUser('ana', 'creator'); // autorizada de antemano, sin verificar

    expect(await root.listProjectsFor('ana')).toEqual([]);

    await root.recordSignIn(a.id, 'ana', true, 'viewer');
    await root.recordSignIn(b.id, 'ana', true, 'viewer');
    expect((await root.listProjectsFor('ana')).map((p) => p.slug)).toEqual(['alpha', 'beta']);
    expect(await root.forProject(b.id).findUser('ana')).toMatchObject({ role: 'creator', verified: true });

    await root.recordSignIn(a.id, 'ana', false, 'viewer');
    await root.recordSignIn(a.id, 'nuevo', false, 'viewer'); // no era miembro: no se crea nada
    expect((await root.listProjectsFor('ana')).map((p) => p.slug)).toEqual(['beta']);
    expect(await root.forProject(a.id).findUser('nuevo')).toBeNull();
  });
});

describe('SqliteOvaStore · migración desde la versión de un solo proyecto', () => {
  let dir: string;
  let path: string;
  const legacy = details('625-ovas-2027', 'org-vieja');

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ova-migration-'));
    path = join(dir, 'ova.db');

    // Esquema de la versión anterior, con datos reales de ejemplo
    const old = new Database(path);
    old.exec(`
      CREATE TABLE schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, slug TEXT NOT NULL UNIQUE);
      CREATE TABLE developers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE);
      CREATE TABLE ovas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        repo_url TEXT NOT NULL,
        school_id INTEGER NOT NULL REFERENCES schools(id),
        developer_id INTEGER NOT NULL REFERENCES developers(id),
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
      CREATE TABLE users (login TEXT PRIMARY KEY COLLATE NOCASE, role TEXT NOT NULL CHECK (role IN ('viewer','creator','admin')), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
      CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')), actor TEXT NOT NULL, action TEXT NOT NULL, repo_name TEXT NOT NULL, repo_url TEXT NOT NULL, details TEXT NOT NULL DEFAULT '{}');
      CREATE INDEX idx_ovas_school ON ovas(school_id);
      INSERT INTO schools (id, name, slug) VALUES (7, 'Ingeniería', 'ingenieria');
      INSERT INTO developers (id, name) VALUES (3, 'Juan');
      INSERT INTO ovas (id, repo_name, repo_url, school_id, developer_id, created_by) VALUES (42, 'ova-001', 'https://github.com/org-vieja/ova-001', 7, 3, 'ana');
      INSERT INTO users (login, role) VALUES ('ana', 'admin');
      INSERT INTO audit_log (id, actor, action, repo_name, repo_url, details) VALUES (5, 'ana', 'created', 'ova-001', 'https://github.com/org-vieja/ova-001', '{"a":1}');
    `);
    old.close();
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('mete todo lo existente en un primer proyecto, conservando los ids', async () => {
    const root = new SqliteOvaStore(path, { legacyProject: legacy });
    const [project] = await root.listProjects();
    const store = root.forProject(project.id);

    expect(project).toMatchObject({ slug: '625-ovas-2027', org: 'org-vieja', total: 10 });
    expect(await store.listSchools()).toEqual([{ id: 7, name: 'Ingeniería', slug: 'ingenieria' }]);
    expect(await store.listDevelopers()).toEqual([{ id: 3, name: 'Juan' }]);
    expect(await store.findById(42)).toMatchObject({
      repoName: 'ova-001',
      school: { id: 7 },
      developer: { id: 3 },
      createdBy: 'ana',
    });
    expect(await store.findUser('ana')).toMatchObject({ role: 'admin', verified: true });
    expect((await root.listProjectsFor('ana')).map((p) => p.slug)).toEqual(['625-ovas-2027']);
    const activity = await store.listActivity({}, 10, 0);
    expect(activity.entries).toMatchObject([{ id: 5, actor: 'ana', details: { a: 1 } }]);

    // Se puede seguir usando: ids nuevos continúan y el esquema nuevo está completo
    const school = await store.addSchool({ name: 'Letras', slug: 'letras' });
    expect(school.id).toBeGreaterThan(7);
    root.close();
  });

  it('guarda una copia de seguridad de la base antes de migrar', () => {
    new SqliteOvaStore(path, { legacyProject: legacy }).close();

    expect(existsSync(`${path}.pre-projects.bak`)).toBe(true);
    const backup = new Database(`${path}.pre-projects.bak`, { readonly: true });
    expect(backup.prepare('SELECT COUNT(*) AS n FROM ovas').get()).toEqual({ n: 1 });
    expect(backup.prepare("SELECT name FROM sqlite_master WHERE name = 'projects'").get()).toBeUndefined();
    backup.close();
  });

  it('es idempotente: reabrir la base ya migrada no necesita la configuración', async () => {
    new SqliteOvaStore(path, { legacyProject: legacy }).close();

    const root = new SqliteOvaStore(path);

    expect((await root.listProjects()).map((p) => p.slug)).toEqual(['625-ovas-2027']);
    root.close();
  });

  it('se niega a migrar sin los datos del proyecto y no toca la base', () => {
    expect(() => new SqliteOvaStore(path)).toThrow('Legacy database needs the settings');

    const check = new Database(path, { readonly: true });
    expect(check.prepare('SELECT COUNT(*) AS n FROM ovas').get()).toEqual({ n: 1 });
    check.close();
  });

  it('migra una base vieja sin usuarios ni actividad', async () => {
    rmSync(path);
    const old = new Database(path);
    old.exec(`
      CREATE TABLE schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE);
      CREATE TABLE developers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
      INSERT INTO schools (name, slug) VALUES ('Letras', 'letras');
    `);
    old.close();

    const root = new SqliteOvaStore(path, { legacyProject: legacy });
    const [project] = await root.listProjects();

    expect(await root.forProject(project.id).listSchools()).toHaveLength(1);
    expect(await root.forProject(project.id).listUsers()).toEqual([]);
    root.close();
  });
});
