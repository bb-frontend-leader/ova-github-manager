import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import type { RepositoryGateway } from '../../application/ports';
import { MAX_REASSIGN, ReassignOvasUseCase } from '../../application/ReassignOvasUseCase';
import { UpdateOvaUseCase } from '../../application/UpdateOvaUseCase';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

describe('ReassignOvasUseCase', () => {
  let store: SqliteProjectStore;
  let gateway: jest.Mocked<RepositoryGateway>;
  let useCase: ReassignOvasUseCase;
  let ana: number;
  let luis: number;
  let ovaIds: number[];

  beforeEach(async () => {
    store = await openProjectStore();
    gateway = {
      createRepository: jest.fn(),
      assignTeam: jest.fn(),
      replaceTopics: jest.fn(),
      getTopics: jest.fn(),
      getRepository: jest.fn(),
      repositoryExists: jest.fn(),
      listRepositories: jest.fn(),
    };
    const catalog = new ManageCatalogUseCase(store);
    const school = await catalog.addSchool('Ingeniería');
    ana = (await catalog.addDeveloper('Ana')).id;
    luis = (await catalog.addDeveloper('Luis')).id;
    ovaIds = [];
    for (let i = 1; i <= 4; i++) {
      const created = await store.add({
        repoName: `GR-${i}`,
        repoUrl: `https://github.com/mi-org/GR-${i}`,
        schoolId: school.id,
        developerId: ana,
        createdBy: 'alejo',
      });
      ovaIds.push(created.id);
    }
    useCase = new ReassignOvasUseCase(
      new UpdateOvaUseCase(gateway, store, store, { org: 'mi-org' }, store),
      store,
    );
  });

  afterEach(() => store.close());

  const developerOf = async (id: number) => (await store.findById(id))?.developer.id;

  it('pasa las OVAs elegidas al desarrollador y deja las demás', async () => {
    const result = await useCase.execute({ ovaIds: ovaIds.slice(0, 3), developerId: luis, actor: 'maria' });

    expect(result.developer.name).toBe('Luis');
    expect(result.moved.map((o) => o.repoName)).toEqual(['GR-1', 'GR-2', 'GR-3']);
    expect(result.unchanged).toEqual([]);
    expect(result.failed).toEqual([]);
    expect(await Promise.all(ovaIds.map(developerOf))).toEqual([luis, luis, luis, ana]);
  });

  it('anota cada cambio en la actividad, con quién lo hizo', async () => {
    await useCase.execute({ ovaIds: ovaIds.slice(0, 2), developerId: luis, actor: 'maria' });

    const { entries, total } = await store.listActivity({ action: 'ova.updated' }, 10, 0);
    expect(total).toBe(2);
    expect(entries[0]).toMatchObject({
      actor: 'maria',
      details: { developer: 'Luis', changes: [{ field: 'developer', from: 'Ana', to: 'Luis' }] },
    });
  });

  it('no toca GitHub: cambiar de desarrollador es solo del registro', async () => {
    await useCase.execute({ ovaIds, developerId: luis, actor: 'maria' });

    expect(gateway.replaceTopics).not.toHaveBeenCalled();
    expect(gateway.getTopics).not.toHaveBeenCalled();
  });

  it('las que ya eran de ese desarrollador no cambian ni se anotan', async () => {
    await useCase.execute({ ovaIds: [ovaIds[0]], developerId: luis, actor: 'maria' });

    const result = await useCase.execute({ ovaIds: ovaIds.slice(0, 3), developerId: luis, actor: 'maria' });

    expect(result.unchanged.map((o) => o.repoName)).toEqual(['GR-1']);
    expect(result.moved.map((o) => o.repoName)).toEqual(['GR-2', 'GR-3']);
    expect((await store.listActivity({}, 50, 0)).total).toBe(3); // 1 + 2
  });

  it('ignora los repetidos y los identificadores inválidos', async () => {
    const result = await useCase.execute({
      ovaIds: [ovaIds[0], ovaIds[0], -1, 0, 1.5, NaN],
      developerId: luis,
      actor: 'maria',
    });

    expect(result.moved).toHaveLength(1);
    expect(result.failed).toEqual([]);
  });

  it('una OVA que ya no existe se informa y no impide cambiar las demás', async () => {
    const result = await useCase.execute({ ovaIds: [ovaIds[0], 9999, ovaIds[1]], developerId: luis, actor: 'maria' });

    expect(result.moved).toHaveLength(2);
    expect(result.failed).toEqual([{ ovaId: 9999, message: 'OVA not found' }]);
  });

  it('si el desarrollador no existe, no cambia ninguna', async () => {
    await expect(useCase.execute({ ovaIds, developerId: 9999, actor: 'maria' })).rejects.toThrow(
      'School or developer does not exist',
    );

    expect(await Promise.all(ovaIds.map(developerOf))).toEqual([ana, ana, ana, ana]);
  });

  it('no acepta un desarrollador que es de otro proyecto', async () => {
    const other = await openProjectStore();
    const stranger = await new ManageCatalogUseCase(other).addDeveloper('Ajeno');
    // El almacén de este proyecto no lo conoce, aunque el identificador exista en otro
    expect(await store.findDeveloper(stranger.id + 1000)).toBeNull();

    await expect(useCase.execute({ ovaIds, developerId: stranger.id + 1000, actor: 'maria' })).rejects.toThrow(
      'does not exist',
    );
    other.close();
  });

  it('exige elegir al menos una OVA', async () => {
    await expect(useCase.execute({ ovaIds: [], developerId: luis, actor: 'maria' })).rejects.toThrow(
      'No OVAs selected',
    );
    await expect(useCase.execute({ ovaIds: [-3, 0], developerId: luis, actor: 'maria' })).rejects.toThrow(
      'No OVAs selected',
    );
  });

  it('pone un tope por operación y no cambia nada si se pasa', async () => {
    const tooMany = Array.from({ length: MAX_REASSIGN + 1 }, (_, i) => i + 1);

    await expect(useCase.execute({ ovaIds: tooMany, developerId: luis, actor: 'maria' })).rejects.toThrow(
      `Too many OVAs selected: max ${MAX_REASSIGN}`,
    );
    expect(await developerOf(ovaIds[0])).toBe(ana);
  });

  it('cuenta los avisos cuando el cambio se guardó pero no se pudo anotar', async () => {
    const failingAudit = { record: jest.fn().mockRejectedValue(new Error('disco lleno')), listActivity: jest.fn() };
    const noisy = new ReassignOvasUseCase(
      new UpdateOvaUseCase(gateway, store, store, { org: 'mi-org' }, failingAudit),
      store,
    );

    const result = await noisy.execute({ ovaIds: ovaIds.slice(0, 2), developerId: luis, actor: 'maria' });

    expect(result.moved).toHaveLength(2);
    expect(result.warnings).toBe(2);
  });
});
