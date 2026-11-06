import { ProjectArchiveUseCase, parseProjectArchive } from '../../application/ProjectArchive';
import { DuplicateEntryError } from '../../application/errors';
import { SqliteOvaStore } from '../../infrastructure/sqlite';

const PROJECT = {
  slug: 'ovas-2027',
  name: '625 OVAs 2027',
  org: 'org-uno',
  template: 'ova-template',
  defaultTeam: 'Frontend',
  descriptionPrefix: '625 OVAs 2027',
  total: 625,
};

const NOW = new Date('2026-11-06T12:00:00.000Z');

describe('exportar e importar un proyecto (SQLite)', () => {
  let store: SqliteOvaStore;
  let projectId: number;
  const validateOrgAccess = jest.fn(async () => undefined);
  let archive: ProjectArchiveUseCase;

  /** Un proyecto con de todo: catálogo, OVAs en distintos estados, usuarios y actividad. */
  async function populate(target: SqliteOvaStore, details = PROJECT): Promise<number> {
    const { id } = await target.createProject(details);
    const project = target.forProject(id);
    const norte = await project.addSchool({ name: 'Escuela Norte', slug: 'escuela-norte' });
    const sur = await project.addSchool({ name: 'Escuela Sur', slug: 'escuela-sur' });
    const ana = await project.addDeveloper({ name: 'Ana Pérez', githubLogin: 'ana-dev' });
    const luis = await project.addDeveloper({ name: 'Luis', githubLogin: null });

    await project.add({
      repoName: 'GR-2-88-2027-1',
      repoUrl: 'https://github.com/org-uno/GR-2-88-2027-1',
      schoolId: norte.id,
      developerId: ana.id,
      createdBy: 'admin1',
    });
    const second = await project.add({
      repoName: 'GR-2-89-2027-1',
      repoUrl: 'https://github.com/org-uno/GR-2-89-2027-1',
      schoolId: sur.id,
      developerId: luis.id,
      createdBy: 'admin1',
    });
    await project.update(second.id, { status: 'review' });

    await project.createUser('admin1', 'admin');
    await project.createUser('lector', 'viewer');
    await project.record({
      actor: 'admin1',
      action: 'ova.created',
      repoName: 'GR-2-88-2027-1',
      repoUrl: 'https://github.com/org-uno/GR-2-88-2027-1',
      details: { school: 'Escuela Norte', developer: 'Ana Pérez' },
    });
    await project.record({
      actor: 'admin1',
      action: 'ova.status_changed',
      repoName: 'GR-2-89-2027-1',
      repoUrl: 'https://github.com/org-uno/GR-2-89-2027-1',
      details: { changes: [{ field: 'status', from: 'development', to: 'review' }] },
    });
    return id;
  }

  beforeEach(async () => {
    store = new SqliteOvaStore(':memory:');
    projectId = await populate(store);
    validateOrgAccess.mockClear();
    archive = new ProjectArchiveUseCase(store, { validateOrgAccess });
  });

  afterEach(() => store.close());

  /** Exporta el proyecto y lo importa en una base nueva, como al pasarlo a otra instalación. */
  async function moveToNewInstallation(options?: { slug?: string }) {
    const { json } = await archive.export(projectId, 'admin1', NOW);
    const other = new SqliteOvaStore(':memory:');
    const importer = new ProjectArchiveUseCase(other, { validateOrgAccess });
    const result = await importer.import(json, options);
    return { other, result, json };
  }

  it('exporta todo el proyecto con su nombre de archivo y los totales', async () => {
    const { fileName, json, counts } = await archive.export(projectId, 'admin1', NOW);

    expect(fileName).toBe('ovas-2027-proyecto-2026-11-06.json');
    expect(counts).toEqual({ schools: 2, developers: 2, ovas: 2, members: 2, activity: 2 });
    const parsed = parseProjectArchive(json);
    expect(parsed.exportedBy).toBe('admin1');
    expect(parsed.project).toMatchObject({ slug: 'ovas-2027', org: 'org-uno', total: 625 });
  });

  it('no lleva datos de otros proyectos', async () => {
    await populate(store, { ...PROJECT, slug: 'otro', name: 'Otro', org: 'org-dos' });

    const { json, counts } = await archive.export(projectId, 'admin1', NOW);

    expect(counts.ovas).toBe(2);
    expect(json).not.toContain('org-dos');
  });

  it('no lleva la verificación de los usuarios ni identificadores internos', async () => {
    const { json } = await archive.export(projectId, 'admin1', NOW);

    expect(json).not.toMatch(/verified/i);
    expect(json).not.toMatch(/"id"|project_id/);
  });

  it('exportar un proyecto que no existe falla', async () => {
    await expect(archive.export(999, 'admin1')).rejects.toThrow('Project not found');
  });

  it('importa en otra instalación el mismo proyecto, con todo su contenido', async () => {
    const { other, result } = await moveToNewInstallation();

    expect(result.counts).toEqual({ schools: 2, developers: 2, ovas: 2, members: 2, activity: 2 });
    expect(result.project).toMatchObject({ slug: 'ovas-2027', org: 'org-uno', total: 625, name: '625 OVAs 2027' });

    const imported = other.forProject(result.project.id);
    const ovas = await imported.list();
    expect(ovas.map((o) => o.repoName).sort()).toEqual(['GR-2-88-2027-1', 'GR-2-89-2027-1']);
    const second = ovas.find((o) => o.repoName === 'GR-2-89-2027-1');
    expect(second).toMatchObject({
      status: 'review',
      school: { name: 'Escuela Sur', slug: 'escuela-sur' },
      developer: { name: 'Luis', githubLogin: null },
      createdBy: 'admin1',
    });
    const first = ovas.find((o) => o.repoName === 'GR-2-88-2027-1');
    expect(first?.developer).toMatchObject({ name: 'Ana Pérez', githubLogin: 'ana-dev' });
    other.close();
  });

  it('conserva fechas, estado y el reloj del estado de cada OVA', async () => {
    const original = await store.forProject(projectId).list();
    const { other, result } = await moveToNewInstallation();

    const imported = await other.forProject(result.project.id).list();
    const byName = (list: typeof original) => new Map(list.map((o) => [o.repoName, o]));
    for (const [name, ova] of byName(original)) {
      const copy = byName(imported).get(name);
      expect(copy).toMatchObject({
        createdAt: ova.createdAt,
        status: ova.status,
        statusChangedAt: ova.statusChangedAt,
      });
    }
    other.close();
  });

  it('conserva la actividad en orden y con su detalle', async () => {
    const { other, result } = await moveToNewInstallation();

    const { entries, total } = await other.forProject(result.project.id).listActivity({}, 50, 0);

    expect(total).toBe(2);
    const changed = entries.find((e) => e.action === 'ova.status_changed');
    expect(changed?.details.changes).toEqual([{ field: 'status', from: 'development', to: 'review' }]);
    expect(entries.find((e) => e.action === 'ova.created')?.details).toMatchObject({ school: 'Escuela Norte' });
    other.close();
  });

  it('los usuarios llegan con su rol pero sin verificar: no entran hasta iniciar sesión', async () => {
    await store.recordSignIn(projectId, 'admin1', true, 'viewer');
    expect((await store.listProjectsFor('admin1')).map((p) => p.slug)).toEqual(['ovas-2027']);

    const { other, result } = await moveToNewInstallation();

    const users = await other.forProject(result.project.id).listUsers();
    expect(users).toEqual([
      expect.objectContaining({ login: 'admin1', role: 'admin', verified: false }),
      expect.objectContaining({ login: 'lector', role: 'viewer', verified: false }),
    ]);
    expect(await other.listProjectsFor('admin1')).toEqual([]);

    // Al iniciar sesión y comprobar que sigue en la organización, recupera el acceso con su rol
    await other.recordSignIn(result.project.id, 'admin1', true, 'viewer');
    expect((await other.listProjectsFor('admin1')).map((p) => p.slug)).toEqual(['ovas-2027']);
    expect((await other.forProject(result.project.id).findUser('admin1'))?.role).toBe('admin');
    other.close();
  });

  it('comprueba que la herramienta puede ver la organización antes de importar', async () => {
    validateOrgAccess.mockRejectedValueOnce(new Error('Access denied or organization not found'));
    const { json } = await archive.export(projectId, 'admin1', NOW);
    const other = new SqliteOvaStore(':memory:');

    await expect(new ProjectArchiveUseCase(other, { validateOrgAccess }).import(json)).rejects.toThrow(
      'Access denied',
    );

    expect(await other.listProjects()).toEqual([]);
    other.close();
  });

  it('no mezcla ni sobrescribe: importar donde ya está la organización falla y no cambia nada', async () => {
    const { json } = await archive.export(projectId, 'admin1', NOW);
    const before = await store.forProject(projectId).stats();

    await expect(archive.import(json, { slug: 'copia' })).rejects.toThrow(DuplicateEntryError);
    await expect(archive.import(json, { slug: 'copia' })).rejects.toThrow('Organization already registered: org-uno');

    expect((await store.listProjects()).map((p) => p.slug)).toEqual(['ovas-2027']);
    expect(await store.forProject(projectId).stats()).toEqual(before);
  });

  it('si el identificador ya está en uso por otro proyecto, falla sin dejar nada a medias', async () => {
    const { json } = await archive.export(projectId, 'admin1', NOW);
    const other = new SqliteOvaStore(':memory:');
    const taken = await other.createProject({ ...PROJECT, org: 'org-tres' });

    const importer = new ProjectArchiveUseCase(other, { validateOrgAccess });
    await expect(importer.import(json)).rejects.toThrow('Project already exists: ovas-2027');

    expect((await other.listProjects()).map((p) => p.id)).toEqual([taken.id]);
    expect((await other.forProject(taken.id).stats()).total).toBe(0);
    other.close();
  });

  it('permite elegir otro identificador al importar', async () => {
    const other = new SqliteOvaStore(':memory:');
    await other.createProject({ ...PROJECT, org: 'org-tres' });
    const { json } = await archive.export(projectId, 'admin1', NOW);

    const { project } = await new ProjectArchiveUseCase(other, { validateOrgAccess }).import(json, {
      slug: 'ovas-2027-copia',
    });

    expect(project.slug).toBe('ovas-2027-copia');
    expect((await other.forProject(project.id).list())).toHaveLength(2);
    other.close();
  });

  it('rechaza un identificador elegido que no es válido', async () => {
    const { json } = await archive.export(projectId, 'admin1', NOW);

    await expect(archive.import(json, { slug: 'Mal Identificador' })).rejects.toThrow('Invalid project identifier');
  });

  it('una importación que falla a mitad no deja el proyecto a medias', async () => {
    const { json } = await archive.export(projectId, 'admin1', NOW);
    const other = new SqliteOvaStore(':memory:');
    // Estropea la importación después de crear el proyecto: la OVA apunta a una escuela inexistente
    const archiveStore = other as unknown as { importProject: SqliteOvaStore['importProject'] };
    const original = archiveStore.importProject.bind(other);
    archiveStore.importProject = (snapshot) =>
      original({ ...snapshot, ovas: snapshot.ovas.map((o) => ({ ...o, school: 'no-existe' })) });

    await expect(new ProjectArchiveUseCase(other, { validateOrgAccess }).import(json)).rejects.toThrow(
      'Archive is inconsistent',
    );

    expect(await other.listProjects()).toEqual([]);
    other.close();
  });

  it('exportar otra vez lo importado da el mismo contenido', async () => {
    const { other, result, json } = await moveToNewInstallation();

    const again = await new ProjectArchiveUseCase(other, { validateOrgAccess }).export(
      result.project.id,
      'admin1',
      NOW,
    );

    expect(JSON.parse(again.json)).toEqual(JSON.parse(json));
    other.close();
  });

  it('la actividad guardada con un detalle dañado no impide exportar', async () => {
    // Una fila antigua con JSON roto en `details`
    (store as unknown as { db: import('better-sqlite3').Database }).db
      .prepare(
        "INSERT INTO audit_log (project_id, actor, action, repo_name, repo_url, details) VALUES (?, 'x', 'ova.created', 'r', '', '{roto')",
      )
      .run(projectId);

    const { counts, json } = await archive.export(projectId, 'admin1', NOW);

    expect(counts.activity).toBe(3);
    expect(parseProjectArchive(json).activity.some((a) => a.repoName === 'r' && Object.keys(a.details).length === 0)).toBe(true);
  });
});
