import { CreateOvaUseCase } from '../../application/CreateOvaUseCase';
import { CreateRepositoryUseCase } from '../../application/CreateRepositoryUseCase';
import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import type { AuditLog } from '../../application/audit';
import type { RepositoryGateway } from '../../application/ports';
import { SyncOvasUseCase } from '../../application/SyncOvasUseCase';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

describe('registro de actividad al crear y sincronizar', () => {
  let store: SqliteProjectStore;
  let gateway: jest.Mocked<RepositoryGateway>;
  let schoolId: number;
  let developerId: number;

  beforeEach(async () => {
    store = await openProjectStore();
    gateway = {
      createRepository: jest.fn().mockImplementation(async ({ org, name }) => ({
        id: 1,
        name,
        description: null,
        private: true,
        url: `https://github.com/${org}/${name}`,
        owner: { login: org },
      })),
      assignTeam: jest.fn().mockResolvedValue(undefined),
      replaceTopics: jest.fn().mockResolvedValue(undefined),
      getTopics: jest.fn(),
      getRepository: jest.fn(),
      repositoryExists: jest.fn().mockResolvedValue(false),
      listRepositories: jest.fn().mockResolvedValue([
        { id: 9, name: 'otro', description: null, private: true, url: 'u', owner: { login: 'mi-org' } },
      ]),
    };
    const catalog = new ManageCatalogUseCase(store);
    schoolId = (await catalog.addSchool('Ingeniería')).id;
    developerId = (await catalog.addDeveloper('Juan')).id;
  });

  afterEach(() => store.close());

  const build = (audit?: AuditLog) => {
    const sync = new SyncOvasUseCase(gateway, store, { org: 'mi-org' }, audit);
    const create = new CreateOvaUseCase(
      new CreateRepositoryUseCase(gateway, { org: 'mi-org', descriptionPrefix: 'P' }),
      store,
      store,
      {},
      sync,
      audit,
    );
    return { sync, create };
  };
  const input = { rawName: 'GR 1', schoolId: 0, developerId: 0, createdBy: 'alejo' };

  it('anota quién creó la OVA, con escuela y desarrollador', async () => {
    const { create } = build(store);

    const result = await create.execute({ ...input, schoolId, developerId });

    expect(result.success).toBe(true);
    const { entries } = await store.listActivity({}, 10, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: 'alejo',
      action: 'ova.created',
      repoName: 'GR-1',
      repoUrl: 'https://github.com/mi-org/GR-1',
      details: { school: 'Ingeniería', developer: 'Juan' },
    });
  });

  it('crea igual, con un aviso, si falla el registro de actividad', async () => {
    const { create } = build({
      record: async () => {
        throw new Error('disk full');
      },
      listActivity: async () => ({ entries: [], total: 0 }),
    });

    const result = await create.execute({ ...input, schoolId, developerId });

    expect(result.success).toBe(true);
    expect(result.ova).toBeDefined();
    expect(result.warnings.join(' ')).toContain('registro de actividad');
  });

  it('anota las OVAs quitadas por la sincronización, con quién la disparó', async () => {
    const { create, sync } = build(store);
    await create.execute({ ...input, schoolId, developerId });

    await sync.execute('maria');
    await create.execute({ ...input, rawName: 'GR 2', schoolId, developerId });
    await sync.execute();

    const removed = (await store.listActivity({ action: 'ova.removed' }, 10, 0)).entries;
    expect(removed.map((e) => [e.repoName, e.actor])).toEqual([
      ['GR-2', 'sistema'],
      ['GR-1', 'maria'],
    ]);
    expect(removed[0].details).toEqual({
      school: 'Ingeniería',
      developer: 'Juan',
      reason: 'deleted_in_github',
    });
  });

  it('quita igualmente la OVA si falla el registro de actividad', async () => {
    const plain = build();
    await plain.create.execute({ ...input, schoolId, developerId });
    const broken = build({
      record: async () => {
        throw new Error('disk full');
      },
      listActivity: async () => ({ entries: [], total: 0 }),
    });

    const result = await broken.sync.execute();

    expect(result.removed).toHaveLength(1);
    expect(await store.list()).toEqual([]);
  });

  it('anota quién limpió un registro huérfano al volver a crear la OVA', async () => {
    const { create } = build(store);
    await create.execute({ ...input, schoolId, developerId });

    await create.execute({ ...input, createdBy: 'carlos', schoolId, developerId });

    const actions = (await store.listActivity({}, 10, 0)).entries.map((e) => [e.action, e.actor]);
    expect(actions).toEqual([
      ['ova.created', 'carlos'],
      ['ova.removed', 'carlos'],
      ['ova.created', 'alejo'],
    ]);
  });
});
