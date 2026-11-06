import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import { OvaHealthUseCase } from '../../application/OvaHealthUseCase';
import type { RepositoryHealth } from '../../application/ports';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-20T12:00:00.000Z').getTime();
const daysAgo = (days: number) => new Date(NOW - days * DAY_MS).toISOString();

const health = (name: string, overrides: Partial<RepositoryHealth> = {}): RepositoryHealth => ({
  name,
  pushedAt: daysAgo(1),
  openPullRequests: 0,
  ci: 'success',
  archived: false,
  ...overrides,
});

describe('OvaHealthUseCase', () => {
  let store: SqliteProjectStore;
  let listRepositoryHealth: jest.Mock<Promise<RepositoryHealth[]>, [string]>;
  let useCase: OvaHealthUseCase;

  const register = async (name: string, status: 'development' | 'review' | 'delivered' = 'development') => {
    const catalog = new ManageCatalogUseCase(store);
    const school = (await catalog.listSchools())[0] ?? (await catalog.addSchool('Ingeniería'));
    const developer = (await catalog.listDevelopers())[0] ?? (await catalog.addDeveloper('Juan'));
    return store.add({
      repoName: name,
      repoUrl: `https://github.com/mi-org/${name}`,
      schoolId: school.id,
      developerId: developer.id,
      createdBy: 'alejo',
      status,
    });
  };

  beforeEach(async () => {
    store = await openProjectStore();
    listRepositoryHealth = jest.fn();
    useCase = new OvaHealthUseCase({ listRepositoryHealth }, store, { org: 'mi-org' });
  });

  afterEach(() => store.close());

  it('marca como estancada la OVA en curso sin actividad desde hace 10 días o más', async () => {
    await register('GR-1');
    await register('GR-2');
    listRepositoryHealth.mockResolvedValue([
      health('GR-1', { pushedAt: daysAgo(10) }),
      health('GR-2', { pushedAt: daysAgo(9) }),
    ]);

    const report = await useCase.execute(NOW);
    const byName = Object.fromEntries(report.items.map((i) => [i.ova.repoName, i]));

    expect(report.staleAfterDays).toBe(10);
    expect(byName['GR-1']).toMatchObject({ idleDays: 10, stalled: true });
    expect(byName['GR-2']).toMatchObject({ idleDays: 9, stalled: false });
    expect(listRepositoryHealth).toHaveBeenCalledWith('mi-org');
  });

  it('una OVA entregada nunca se marca como estancada', async () => {
    await register('GR-1', 'delivered');
    listRepositoryHealth.mockResolvedValue([health('GR-1', { pushedAt: daysAgo(90) })]);

    const [item] = (await useCase.execute(NOW)).items;

    expect(item.idleDays).toBe(90);
    expect(item.stalled).toBe(false);
  });

  it('una OVA en revisión sin actividad sí se marca como estancada', async () => {
    await register('GR-1', 'review');
    listRepositoryHealth.mockResolvedValue([health('GR-1', { pushedAt: daysAgo(30) })]);

    expect((await useCase.execute(NOW)).items[0].stalled).toBe(true);
  });

  it('respeta el umbral configurado', async () => {
    await register('GR-1');
    listRepositoryHealth.mockResolvedValue([health('GR-1', { pushedAt: daysAgo(4) })]);
    const strict = new OvaHealthUseCase({ listRepositoryHealth }, store, {
      org: 'mi-org',
      staleAfterDays: 3,
    });

    const report = await strict.execute(NOW);

    expect(report.staleAfterDays).toBe(3);
    expect(report.items[0].stalled).toBe(true);
  });

  it('reconoce el repositorio sin distinguir mayúsculas', async () => {
    await register('GR-1');
    listRepositoryHealth.mockResolvedValue([health('gr-1', { openPullRequests: 2, ci: 'failure' })]);

    const [item] = (await useCase.execute(NOW)).items;

    expect(item.health).toMatchObject({ openPullRequests: 2, ci: 'failure' });
  });

  it('si GitHub no trae el repositorio, cuenta la inactividad desde que se creó la OVA', async () => {
    const ova = await register('GR-1');
    listRepositoryHealth.mockResolvedValue([]);
    const afterCreation = new Date(ova.createdAt).getTime() + 12 * DAY_MS;

    const [item] = (await useCase.execute(afterCreation)).items;

    expect(item.health).toBeNull();
    expect(item.idleDays).toBe(12);
    expect(item.stalled).toBe(true);
  });

  it('un repositorio vacío (sin push) cuenta desde que se creó la OVA', async () => {
    const ova = await register('GR-1');
    listRepositoryHealth.mockResolvedValue([health('GR-1', { pushedAt: null })]);

    const [item] = (await useCase.execute(new Date(ova.createdAt).getTime() + 2 * DAY_MS)).items;

    expect(item.idleDays).toBe(2);
    expect(item.stalled).toBe(false);
  });

  it('nunca da días negativos si el reloj del servidor va por detrás', async () => {
    await register('GR-1');
    listRepositoryHealth.mockResolvedValue([health('GR-1', { pushedAt: daysAgo(-3) })]);

    expect((await useCase.execute(NOW)).items[0].idleDays).toBe(0);
  });

  it('usa la hora actual si no se indica', async () => {
    await register('GR-1');
    listRepositoryHealth.mockResolvedValue([health('GR-1', { pushedAt: new Date().toISOString() })]);

    expect((await useCase.execute()).items[0].idleDays).toBe(0);
  });
});
