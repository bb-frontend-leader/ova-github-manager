import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import type { RepositoryData, RepositoryGateway } from '../../application/ports';
import { SyncOvasUseCase } from '../../application/SyncOvasUseCase';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

const repo = (name: string): RepositoryData => ({
  id: 1,
  name,
  description: null,
  private: true,
  url: `https://github.com/mi-org/${name}`,
  owner: { login: 'mi-org' },
});

describe('SyncOvasUseCase', () => {
  let store: SqliteProjectStore;
  let gateway: jest.Mocked<RepositoryGateway>;
  let sync: SyncOvasUseCase;

  const register = async (names: string[]) => {
    const catalog = new ManageCatalogUseCase(store);
    const school = await catalog.addSchool('Ingeniería');
    const developer = await catalog.addDeveloper('Juan');
    for (const repoName of names) {
      await store.add({
        repoName,
        repoUrl: `https://github.com/mi-org/${repoName}`,
        schoolId: school.id,
        developerId: developer.id,
        createdBy: 'alejo',
      });
    }
  };

  beforeEach(async () => {
    store = await openProjectStore();
    gateway = {
      createRepository: jest.fn(),
      assignTeam: jest.fn(),
      replaceTopics: jest.fn(),
      getRepository: jest.fn(),
      getTopics: jest.fn(),
      repositoryExists: jest.fn().mockResolvedValue(false),
      listRepositories: jest.fn(),
    };
    sync = new SyncOvasUseCase(gateway, store, { org: 'mi-org' });
  });

  afterEach(() => store.close());

  it('quita del registro las OVAs cuyo repositorio ya no existe', async () => {
    await register(['GR-1', 'GR-2', 'GR-3']);
    gateway.listRepositories.mockResolvedValue([repo('gr-1'), repo('GR-3'), repo('otro-repo')]);

    const result = await sync.execute();

    expect(result.checked).toBe(3);
    expect(result.removed.map((o) => o.repoName)).toEqual(['GR-2']);
    expect((await store.list()).map((o) => o.repoName).sort()).toEqual(['GR-1', 'GR-3']);
    expect(gateway.repositoryExists).toHaveBeenCalledTimes(1);
    expect(gateway.repositoryExists).toHaveBeenCalledWith('mi-org', 'GR-2');
  });

  it('conserva la OVA si GitHub aún la encuentra aunque no salga en el listado', async () => {
    await register(['GR-1']);
    gateway.listRepositories.mockResolvedValue([repo('otro')]);
    gateway.repositoryExists.mockResolvedValue(true);

    const result = await sync.execute();

    expect(result.removed).toEqual([]);
    expect(await store.list()).toHaveLength(1);
  });

  it('no consulta GitHub si el registro está vacío', async () => {
    const result = await sync.execute();

    expect(result).toEqual({ checked: 0, removed: [] });
    expect(gateway.listRepositories).not.toHaveBeenCalled();
  });

  it('se niega a actuar si GitHub devuelve un listado vacío', async () => {
    await register(['GR-1']);
    gateway.listRepositories.mockResolvedValue([]);

    await expect(sync.execute()).rejects.toThrow('sync aborted');
    expect(await store.list()).toHaveLength(1);
  });

  it('no borra nada si falla la consulta a GitHub', async () => {
    await register(['GR-1']);
    gateway.listRepositories.mockRejectedValue(new Error('Failed to list repositories'));

    await expect(sync.execute()).rejects.toThrow();
    expect(await store.list()).toHaveLength(1);
  });

  it('no borra una OVA si no se puede confirmar su existencia', async () => {
    await register(['GR-1']);
    gateway.listRepositories.mockResolvedValue([repo('otro')]);
    gateway.repositoryExists.mockRejectedValue(new Error('rate limit'));

    await expect(sync.execute()).rejects.toThrow('rate limit');
    expect(await store.list()).toHaveLength(1);
  });

  describe('removeIfMissing', () => {
    it('quita solo si GitHub confirma que no existe', async () => {
      await register(['GR-1']);

      expect(await sync.removeIfMissing('GR-9')).toBe(false);

      gateway.repositoryExists.mockResolvedValue(true);
      expect(await sync.removeIfMissing('GR-1')).toBe(false);

      gateway.repositoryExists.mockResolvedValue(false);
      expect(await sync.removeIfMissing('gr-1')).toBe(true);
      expect(await store.list()).toEqual([]);
    });
  });
});
