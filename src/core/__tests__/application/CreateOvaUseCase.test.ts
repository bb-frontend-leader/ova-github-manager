import { CreateOvaUseCase } from '../../application/CreateOvaUseCase';
import { CreateRepositoryUseCase } from '../../application/CreateRepositoryUseCase';
import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import { DuplicateEntryError } from '../../application/errors';
import { SyncOvasUseCase } from '../../application/SyncOvasUseCase';
import type { RepositoryGateway } from '../../application/ports';
import type { OvaRegistry } from '../../application/registry';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

function makeGateway(): jest.Mocked<RepositoryGateway> {
  const gateway: jest.Mocked<RepositoryGateway> = {
    createRepository: jest.fn(),
    assignTeam: jest.fn().mockResolvedValue(undefined),
    replaceTopics: jest.fn().mockResolvedValue(undefined),
    getRepository: jest.fn(),
    getTopics: jest.fn().mockResolvedValue([]),
    repositoryExists: jest.fn().mockResolvedValue(true),
    listRepositories: jest.fn(),
  };
  gateway.createRepository.mockImplementation(async ({ org, name, description }) => ({
    id: 1,
    name,
    description: description ?? null,
    private: true,
    url: `https://github.com/${org}/${name}`,
    owner: { login: org },
  }));
  return gateway;
}

describe('CreateOvaUseCase', () => {
  let store: SqliteProjectStore;
  let gateway: jest.Mocked<RepositoryGateway>;
  let useCase: CreateOvaUseCase;
  let schoolId: number;
  let developerId: number;

  const buildUseCase = (registry: OvaRegistry = store) =>
    new CreateOvaUseCase(
      new CreateRepositoryUseCase(gateway, {
        org: 'mi-org',
        descriptionPrefix: '625 OVAs 2027',
        defaultTeam: { slug: 'Frontend', permission: 'pull' },
      }),
      registry,
      store,
      { projectTopic: 'ovas-2027', template: 'ova-template' },
    );

  beforeEach(async () => {
    store = await openProjectStore();
    gateway = makeGateway();
    const catalog = new ManageCatalogUseCase(store);
    schoolId = (await catalog.addSchool('Escuela de Ingeniería')).id;
    developerId = (await catalog.addDeveloper('Juan Pérez')).id;
    useCase = buildUseCase();
  });

  afterEach(() => {
    store.close();
  });

  const input = () => ({ rawName: 'GR 2_88-2027-1', schoolId, developerId, createdBy: 'alejo' });

  it('crea el repo con topics de proyecto y escuela, team Frontend y lo registra', async () => {
    const result = await useCase.execute(input());

    expect(result.success).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.ova).toMatchObject({
      repoName: 'GR-2-88-2027-1',
      repoUrl: 'https://github.com/mi-org/GR-2-88-2027-1',
      school: { name: 'Escuela de Ingeniería', slug: 'escuela-de-ingenieria' },
      developer: { name: 'Juan Pérez' },
      createdBy: 'alejo',
    });
    expect(gateway.createRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'GR-2-88-2027-1',
        private: true,
        description: expect.stringMatching(/^625 OVAs 2027 - GR-2-88-2027-1 \S+$/u),
      }),
    );
    expect(gateway.replaceTopics).toHaveBeenCalledWith('mi-org', 'GR-2-88-2027-1', [
      'ovas-2027',
      'escuela-de-ingenieria',
    ]);
    expect(gateway.assignTeam).toHaveBeenCalledWith('mi-org', 'GR-2-88-2027-1', 'Frontend', 'pull');
    expect(await store.findByRepoName('GR-2-88-2027-1')).not.toBeNull();
  });

  describe('registro desactualizado', () => {
    const buildWithSync = () =>
      new CreateOvaUseCase(
        new CreateRepositoryUseCase(gateway, { org: 'mi-org', descriptionPrefix: 'P' }),
        store,
        store,
        {},
        new SyncOvasUseCase(gateway, store, { org: 'mi-org' }),
      );

    it('permite volver a crear una OVA cuyo repositorio fue borrado en GitHub', async () => {
      await useCase.execute(input());
      gateway.createRepository.mockClear();
      gateway.repositoryExists.mockResolvedValue(false);

      const result = await buildWithSync().execute(input());

      expect(result.success).toBe(true);
      expect(result.warnings).toEqual([]);
      expect(gateway.createRepository).toHaveBeenCalledTimes(1);
      expect(await store.list()).toHaveLength(1);
    });

    it('sigue bloqueando el nombre si el repositorio existe en GitHub', async () => {
      await useCase.execute(input());
      gateway.createRepository.mockClear();
      gateway.repositoryExists.mockResolvedValue(true);

      const result = await buildWithSync().execute(input());

      expect(result.success).toBe(false);
      expect(gateway.createRepository).not.toHaveBeenCalled();
    });

    it('sigue bloqueando el nombre si no se puede comprobar en GitHub', async () => {
      await useCase.execute(input());
      gateway.createRepository.mockClear();
      gateway.repositoryExists.mockRejectedValue(new Error('rate limit'));

      const result = await buildWithSync().execute(input());

      expect(result.success).toBe(false);
      expect(gateway.createRepository).not.toHaveBeenCalled();
    });
  });

  it('crea cada OVA a partir del template configurado', async () => {
    await useCase.execute(input());

    expect(gateway.createRepository).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'GR-2-88-2027-1', template: 'ova-template' }),
    );
  });

  it('crea un repositorio vacío si no hay template configurado', async () => {
    const noTemplate = new CreateOvaUseCase(
      new CreateRepositoryUseCase(gateway, { org: 'mi-org', descriptionPrefix: 'P' }),
      store,
      store,
    );

    await noTemplate.execute(input());

    expect(gateway.createRepository).toHaveBeenCalledWith(
      expect.objectContaining({ template: undefined }),
    );
  });

  it('omite el topic de proyecto si no está configurado', async () => {
    const noTopic = new CreateOvaUseCase(
      new CreateRepositoryUseCase(gateway, { org: 'mi-org', descriptionPrefix: 'P' }),
      store,
      store,
    );

    await noTopic.execute(input());

    expect(gateway.replaceTopics).toHaveBeenCalledWith('mi-org', 'GR-2-88-2027-1', [
      'escuela-de-ingenieria',
    ]);
  });

  it('detecta duplicados antes de llamar a GitHub, aunque el nombre se escriba distinto', async () => {
    await useCase.execute(input());
    gateway.createRepository.mockClear();

    const result = await useCase.execute({ ...input(), rawName: 'gr-2-88-2027-1' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('ya está registrada');
    expect(result.message).toContain('Juan Pérez');
    expect(gateway.createRepository).not.toHaveBeenCalled();
  });

  it('rechaza un nombre inválido sin tocar GitHub ni el registro', async () => {
    const result = await useCase.execute({ ...input(), rawName: '   ' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Repository name cannot be empty');
    expect(gateway.createRepository).not.toHaveBeenCalled();
    expect(await store.list()).toEqual([]);
  });

  it('rechaza una escuela inexistente', async () => {
    const result = await useCase.execute({ ...input(), schoolId: 999 });

    expect(result).toMatchObject({ success: false, message: 'La escuela seleccionada no existe' });
    expect(gateway.createRepository).not.toHaveBeenCalled();
  });

  it('rechaza un desarrollador inexistente', async () => {
    const result = await useCase.execute({ ...input(), developerId: 999 });

    expect(result).toMatchObject({
      success: false,
      message: 'El desarrollador seleccionado no existe',
    });
    expect(gateway.createRepository).not.toHaveBeenCalled();
  });

  it('no registra nada si falla la creación en GitHub', async () => {
    gateway.createRepository.mockRejectedValueOnce(new Error('name already exists'));

    const result = await useCase.execute(input());

    expect(result.success).toBe(false);
    expect(result.message).toContain('name already exists');
    expect(result.ova).toBeUndefined();
    expect(await store.list()).toEqual([]);
  });

  it('conserva los warnings de GitHub (team/topics) y aun así registra la OVA', async () => {
    gateway.assignTeam.mockRejectedValueOnce(new Error('Not Found'));

    const result = await useCase.execute(input());

    expect(result.success).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.ova).toBeDefined();
    expect(await store.findByRepoName('GR-2-88-2027-1')).not.toBeNull();
  });

  it('avisa con un warning si el repo se creó pero falló el registro', async () => {
    const brokenRegistry: OvaRegistry = {
      findByRepoName: async () => null,
      add: async () => {
        throw new Error('disk full');
      },
      list: async () => [],
      stats: async () => ({ total: 0, bySchool: [], byDeveloper: [], byStatus: [] }),
      remove: async () => false,
      findById: async () => null,
      update: async () => null,
    };

    const result = await buildUseCase(brokenRegistry).execute(input());

    expect(result.success).toBe(true);
    expect(result.ova).toBeUndefined();
    expect(result.warnings.join(' ')).toContain('no se pudo registrar: disk full');
    expect(result.message).toContain('1 warning');
  });

  it('usa un motivo genérico si el registro falla con algo que no es un Error', async () => {
    const brokenRegistry: OvaRegistry = {
      findByRepoName: async () => null,
      add: async () => {
        throw 'boom';
      },
      list: async () => [],
      stats: async () => ({ total: 0, bySchool: [], byDeveloper: [], byStatus: [] }),
      remove: async () => false,
      findById: async () => null,
      update: async () => null,
    };

    const result = await buildUseCase(brokenRegistry).execute(input());

    expect(result.warnings.join(' ')).toContain('error desconocido');
  });
});

describe('ManageCatalogUseCase', () => {
  let store: SqliteProjectStore;
  let catalog: ManageCatalogUseCase;

  beforeEach(async () => {
    store = await openProjectStore();
    catalog = new ManageCatalogUseCase(store);
  });

  afterEach(() => {
    store.close();
  });

  it('da de alta escuelas normalizando nombre y slug', async () => {
    const school = await catalog.addSchool('  Diseño   Gráfico ');

    expect(school).toMatchObject({ name: 'Diseño Gráfico', slug: 'diseno-grafico' });
    expect(await catalog.listSchools()).toEqual([school]);
  });

  it('da de alta desarrolladores y los lista', async () => {
    const dev = await catalog.addDeveloper(' María  Gómez ');

    expect(dev.name).toBe('María Gómez');
    expect(await catalog.listDevelopers()).toEqual([dev]);
  });

  it('valida con el dominio antes de guardar', async () => {
    await expect(catalog.addSchool('   ')).rejects.toThrow('School name cannot be empty');
    await expect(catalog.addDeveloper('')).rejects.toThrow('Developer name cannot be empty');
  });

  it('propaga DuplicateEntryError al repetir una escuela', async () => {
    await catalog.addSchool('Letras');

    await expect(catalog.addSchool('LETRAS')).rejects.toBeInstanceOf(DuplicateEntryError);
  });
});
