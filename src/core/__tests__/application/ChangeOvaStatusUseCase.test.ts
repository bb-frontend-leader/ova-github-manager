import { ChangeOvaStatusUseCase } from '../../application/ChangeOvaStatusUseCase';
import { ManageCatalogUseCase } from '../../application/ManageCatalogUseCase';
import type { SqliteProjectStore } from '../../infrastructure/sqlite';
import { openProjectStore } from '../helpers';

describe('ChangeOvaStatusUseCase', () => {
  let store: SqliteProjectStore;
  let useCase: ChangeOvaStatusUseCase;
  let ovaId: number;

  beforeEach(async () => {
    store = await openProjectStore();
    const catalog = new ManageCatalogUseCase(store);
    const school = await catalog.addSchool('Ingeniería');
    const developer = await catalog.addDeveloper('Juan');
    const ova = await store.add({
      repoName: 'GR-1',
      repoUrl: 'https://github.com/mi-org/GR-1',
      schoolId: school.id,
      developerId: developer.id,
      createdBy: 'alejo',
    });
    ovaId = ova.id;
    useCase = new ChangeOvaStatusUseCase(store, store);
  });

  afterEach(() => store.close());

  it('mueve la OVA de estado y lo anota en la actividad', async () => {
    const result = await useCase.execute({ ovaId, status: 'review', actor: 'maria' });

    expect(result).toMatchObject({ success: true, changed: true, warnings: [] });
    expect((await store.findById(ovaId))?.status).toBe('review');

    const { entries } = await store.listActivity({ action: 'ova.status_changed' }, 10, 0);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actor: 'maria',
      repoName: 'GR-1',
      details: { changes: [{ field: 'status', from: 'development', to: 'review' }] },
    });
  });

  it('no cambia nada ni anota actividad si ya estaba en ese estado', async () => {
    const result = await useCase.execute({ ovaId, status: 'development', actor: 'maria' });

    expect(result).toMatchObject({ success: true, changed: false });
    expect((await store.listActivity({}, 10, 0)).total).toBe(0);
  });

  it('rechaza un estado que no existe', async () => {
    const result = await useCase.execute({ ovaId, status: 'archivada', actor: 'maria' });

    expect(result).toEqual({ success: false, message: 'Invalid OVA status' });
  });

  it('rechaza una OVA que no existe', async () => {
    const result = await useCase.execute({ ovaId: 999, status: 'review', actor: 'maria' });

    expect(result).toEqual({ success: false, message: 'OVA not found' });
  });

  it('avisa si el cambio se guardó pero no se pudo anotar', async () => {
    const failing = { ...store, record: jest.fn().mockRejectedValue(new Error('disco lleno')) };
    const withBrokenAudit = new ChangeOvaStatusUseCase(store, failing as never);

    const result = await withBrokenAudit.execute({ ovaId, status: 'delivered', actor: 'maria' });

    expect(result).toMatchObject({ success: true, changed: true });
    expect(result.success && result.warnings).toHaveLength(1);
    expect((await store.findById(ovaId))?.status).toBe('delivered');
  });

  it('funciona sin registro de actividad', async () => {
    const withoutAudit = new ChangeOvaStatusUseCase(store);

    const result = await withoutAudit.execute({ ovaId, status: 'review', actor: 'maria' });

    expect(result).toMatchObject({ success: true, changed: true, warnings: [] });
  });

  it('devuelve el error si la OVA desaparece antes de actualizar', async () => {
    const racing = {
      findById: jest.fn().mockResolvedValue(await store.findById(ovaId)),
      update: jest.fn().mockResolvedValue(null),
    };
    const useCaseWithRace = new ChangeOvaStatusUseCase(racing as never);

    const result = await useCaseWithRace.execute({ ovaId, status: 'review', actor: 'maria' });

    expect(result).toEqual({ success: false, message: 'OVA not found' });
  });
});
