import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import type { RepositoryGateway } from '../../application/ports';
import { UpdateOvaUseCase } from '../../application/UpdateOvaUseCase';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

describe('UpdateOvaUseCase', () => {
  let store: SqliteProjectStore;
  let gateway: jest.Mocked<RepositoryGateway>;
  let useCase: UpdateOvaUseCase;
  let ids: { ing: number; letras: number; juan: number; maria: number; ova: number };

  beforeEach(async () => {
    store = await openProjectStore();
    gateway = {
      createRepository: jest.fn(),
      assignTeam: jest.fn(),
      replaceTopics: jest.fn().mockResolvedValue(undefined),
      getTopics: jest.fn().mockResolvedValue(['ingenieria', 'otro-topic']),
      getRepository: jest.fn(),
      repositoryExists: jest.fn(),
      listRepositories: jest.fn(),
    };
    useCase = new UpdateOvaUseCase(gateway, store, store, { org: 'mi-org' }, store);

    const catalog = new ManageCatalogUseCase(store);
    const ing = await catalog.addSchool('Ingeniería');
    const letras = await catalog.addSchool('Letras');
    const juan = await catalog.addDeveloper('Juan');
    const maria = await catalog.addDeveloper('María');
    const ova = await store.add({
      repoName: 'GR-1',
      repoUrl: 'https://github.com/mi-org/GR-1',
      schoolId: ing.id,
      developerId: juan.id,
      createdBy: 'alejo',
    });
    ids = { ing: ing.id, letras: letras.id, juan: juan.id, maria: maria.id, ova: ova.id };
  });

  afterEach(() => store.close());

  it('cambia solo el desarrollador sin tocar GitHub', async () => {
    const result = await useCase.execute({ ovaId: ids.ova, developerId: ids.maria, actor: 'carlos' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.ova.developer.name).toBe('María');
    expect(result.ova.school.name).toBe('Ingeniería');
    expect(result.changes).toEqual([{ field: 'developer', from: 'Juan', to: 'María' }]);
    expect(gateway.getTopics).not.toHaveBeenCalled();
    expect(gateway.replaceTopics).not.toHaveBeenCalled();
  });

  it('cambia la escuela y su topic en GitHub, conservando los demás topics', async () => {
    const result = await useCase.execute({ ovaId: ids.ova, schoolId: ids.letras, actor: 'carlos' });

    expect(result.success).toBe(true);
    expect(gateway.replaceTopics).toHaveBeenCalledWith('mi-org', 'GR-1', ['otro-topic', 'letras']);
    expect((await store.findById(ids.ova))?.school.slug).toBe('letras');
  });

  it('no cambia el registro si GitHub rechaza el cambio de topics', async () => {
    gateway.replaceTopics.mockRejectedValue(new Error('Failed to set topics on mi-org/GR-1: 403'));

    const result = await useCase.execute({ ovaId: ids.ova, schoolId: ids.letras, actor: 'carlos' });

    expect(result).toEqual({ success: false, message: 'Failed to set topics on mi-org/GR-1: 403' });
    expect((await store.findById(ids.ova))?.school.name).toBe('Ingeniería');
    expect((await store.listActivity({}, 10, 0)).total).toBe(0);
  });

  it('anota el cambio en el registro de actividad con quién lo hizo', async () => {
    await useCase.execute({
      ovaId: ids.ova,
      schoolId: ids.letras,
      developerId: ids.maria,
      actor: 'carlos',
    });

    const { entries } = await store.listActivity({}, 10, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: 'carlos',
      action: 'ova.updated',
      repoName: 'GR-1',
      repoUrl: 'https://github.com/mi-org/GR-1',
      details: {
        school: 'Letras',
        developer: 'María',
        changes: [
          { field: 'school', from: 'Ingeniería', to: 'Letras' },
          { field: 'developer', from: 'Juan', to: 'María' },
        ],
      },
    });
  });

  it('no hace nada ni anota si no hay cambios reales', async () => {
    const result = await useCase.execute({
      ovaId: ids.ova,
      schoolId: ids.ing,
      developerId: ids.juan,
      actor: 'carlos',
    });

    expect(result).toMatchObject({ success: true, changes: [] });
    expect(gateway.replaceTopics).not.toHaveBeenCalled();
    expect((await store.listActivity({}, 10, 0)).total).toBe(0);
  });

  it('falla si la OVA, la escuela o el desarrollador no existen', async () => {
    expect(await useCase.execute({ ovaId: 999, developerId: ids.maria, actor: 'a' })).toEqual({
      success: false,
      message: 'OVA not found',
    });
    expect(await useCase.execute({ ovaId: ids.ova, schoolId: 999, actor: 'a' })).toMatchObject({
      success: false,
    });
    expect(await useCase.execute({ ovaId: ids.ova, developerId: 999, actor: 'a' })).toMatchObject({
      success: false,
    });
  });

  it('avisa, pero conserva el cambio, si falla el registro de actividad', async () => {
    const broken = new UpdateOvaUseCase(gateway, store, store, { org: 'mi-org' }, {
      record: async () => {
        throw new Error('disk full');
      },
      listActivity: async () => ({ entries: [], total: 0 }),
    });

    const result = await broken.execute({ ovaId: ids.ova, developerId: ids.maria, actor: 'a' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.warnings.join(' ')).toContain('registro de actividad');
    expect((await store.findById(ids.ova))?.developer.name).toBe('María');
  });
});
