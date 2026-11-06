import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import { WorkloadUseCase, loadLevel } from '../../application/WorkloadUseCase';
import type { OvaStatus } from '../../domain/OvaStatus';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

describe('loadLevel', () => {
  it.each([
    // [activas, promedio, nivel]
    [9, 4, 'high'], // 2,25 veces el promedio y 5 más
    [6, 4, 'high'], // 1,5 veces y 2 más: en el límite
    [5, 4, 'normal'], // no llega al 1,5
    [3, 2, 'normal'], // 1,5 veces pero solo 1 más: poco para llamarlo mucho
    [0, 4, 'low'],
    [2, 4, 'low'], // la mitad y 2 menos: en el límite
    [3, 4, 'normal'],
    [0, 1, 'normal'], // con promedios chicos, 1 de diferencia no cuenta
    [7, 0, 'normal'], // sin promedio no hay con qué comparar
  ])('%i activas con promedio %f es "%s"', (active, average, level) => {
    expect(loadLevel(active, average)).toBe(level);
  });
});

describe('WorkloadUseCase', () => {
  let store: SqliteProjectStore;
  let schoolId: number;
  let catalog: ManageCatalogUseCase;
  let useCase: WorkloadUseCase;
  let n = 0;

  /** Crea una OVA de ese desarrollador en ese estado; devuelve su id. */
  async function ova(developerId: number, status: OvaStatus): Promise<number> {
    n += 1;
    const created = await store.add({
      repoName: `GR-${n}`,
      repoUrl: `https://github.com/mi-org/GR-${n}`,
      schoolId,
      developerId,
      createdBy: 'alejo',
      status,
    });
    return created.id;
  }

  beforeEach(async () => {
    n = 0;
    store = await openProjectStore();
    catalog = new ManageCatalogUseCase(store);
    schoolId = (await catalog.addSchool('Ingeniería')).id;
    useCase = new WorkloadUseCase(store, store);
  });

  afterEach(() => store.close());

  it('sin desarrolladores, el informe está vacío', async () => {
    expect(await useCase.execute()).toEqual({
      developers: [],
      averageActive: 0,
      totalActive: 0,
      withoutLoad: 0,
    });
  });

  it('cuenta cada estado y las activas (desarrollo + revisión); las entregadas no son carga', async () => {
    const ana = await catalog.addDeveloper('Ana');
    await ova(ana.id, 'development');
    await ova(ana.id, 'development');
    await ova(ana.id, 'review');
    await ova(ana.id, 'delivered');

    const { developers } = await useCase.execute();

    expect(developers[0]).toMatchObject({
      development: 2,
      review: 1,
      delivered: 1,
      active: 3,
      total: 4,
      stalled: null,
    });
  });

  it('incluye a quien no lleva ninguna OVA: es capacidad libre', async () => {
    const ana = await catalog.addDeveloper('Ana');
    await catalog.addDeveloper('Luis');
    await ova(ana.id, 'development');

    const report = await useCase.execute();

    expect(report.developers.map((d) => [d.developer.name, d.active])).toEqual([
      ['Ana', 1],
      ['Luis', 0],
    ]);
    expect(report.withoutLoad).toBe(1);
  });

  it('ordena por carga y, a igual carga, por nombre', async () => {
    const zoe = await catalog.addDeveloper('Zoe');
    const ana = await catalog.addDeveloper('Ana');
    const bea = await catalog.addDeveloper('Bea');
    await ova(zoe.id, 'development');
    await ova(zoe.id, 'development');
    await ova(ana.id, 'review');
    await ova(bea.id, 'development');

    const { developers } = await useCase.execute();

    expect(developers.map((d) => d.developer.name)).toEqual(['Zoe', 'Ana', 'Bea']);
  });

  it('calcula el promedio entre todos los desarrolladores y la diferencia de cada uno', async () => {
    const ana = await catalog.addDeveloper('Ana');
    const luis = await catalog.addDeveloper('Luis');
    await catalog.addDeveloper('Eva');
    for (let i = 0; i < 4; i++) await ova(ana.id, 'development');
    await ova(luis.id, 'review');

    const report = await useCase.execute();

    expect(report.totalActive).toBe(5);
    expect(report.averageActive).toBe(1.7);
    expect(report.developers.map((d) => [d.developer.name, d.vsAverage])).toEqual([
      ['Ana', 2.3],
      ['Luis', -0.7],
      ['Eva', -1.7],
    ]);
  });

  it('marca quién tiene mucha carga y quién tiene hueco', async () => {
    const ana = await catalog.addDeveloper('Ana');
    const luis = await catalog.addDeveloper('Luis');
    const eva = await catalog.addDeveloper('Eva');
    const bea = await catalog.addDeveloper('Bea');
    const tom = await catalog.addDeveloper('Tom');
    for (let i = 0; i < 9; i++) await ova(ana.id, 'development');
    for (let i = 0; i < 4; i++) await ova(luis.id, 'development');
    for (let i = 0; i < 4; i++) await ova(bea.id, 'review');
    for (let i = 0; i < 4; i++) await ova(tom.id, 'development');
    await ova(eva.id, 'delivered');

    const byName = Object.fromEntries((await useCase.execute()).developers.map((d) => [d.developer.name, d.level]));

    // promedio = 21 / 5 = 4,2
    expect(byName).toEqual({ Ana: 'high', Luis: 'normal', Bea: 'normal', Tom: 'normal', Eva: 'low' });
  });

  it('cuenta las estancadas solo entre las activas, cuando se conocen', async () => {
    const ana = await catalog.addDeveloper('Ana');
    const a = await ova(ana.id, 'development');
    const b = await ova(ana.id, 'review');
    const delivered = await ova(ana.id, 'delivered');
    await ova(ana.id, 'development');

    const { developers } = await useCase.execute(new Set([a, b, delivered]));

    expect(developers[0].stalled).toBe(2); // la entregada no cuenta
  });

  it('con datos de actividad y ninguna estancada, el contador es 0 (no "sin datos")', async () => {
    const ana = await catalog.addDeveloper('Ana');
    await ova(ana.id, 'development');

    expect((await useCase.execute(new Set())).developers[0].stalled).toBe(0);
  });
});
