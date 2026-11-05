import { SqliteOvaStore } from '../../infrastructure/sqlite';
import type { NewAuditEntry } from '../../application/audit';

const entry = (overrides: Partial<NewAuditEntry> = {}): NewAuditEntry => ({
  actor: 'alejo',
  action: 'ova.created',
  repoName: 'GR-1',
  repoUrl: 'https://github.com/mi-org/GR-1',
  details: { school: 'Ingeniería', developer: 'Juan' },
  ...overrides,
});

describe('SqliteOvaStore · registro de actividad', () => {
  let store: SqliteOvaStore;

  beforeEach(() => {
    store = new SqliteOvaStore(':memory:');
  });

  afterEach(() => store.close());

  it('guarda las entradas y las lista de la más reciente a la más antigua', async () => {
    await store.record(entry({ repoName: 'GR-1' }));
    await store.record(entry({ repoName: 'GR-2', action: 'ova.removed', details: { reason: 'deleted_in_github' } }));

    const { entries, total } = await store.listActivity({}, 10, 0);

    expect(total).toBe(2);
    expect(entries.map((e) => e.repoName)).toEqual(['GR-2', 'GR-1']);
    expect(entries[0].details).toEqual({ reason: 'deleted_in_github' });
    expect(entries[1].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('pagina con límite y desplazamiento', async () => {
    for (let i = 1; i <= 5; i++) await store.record(entry({ repoName: `GR-${i}` }));

    const page = await store.listActivity({}, 2, 2);

    expect(page.total).toBe(5);
    expect(page.entries.map((e) => e.repoName)).toEqual(['GR-3', 'GR-2']);
  });

  it('filtra por acción y busca por repositorio o autor', async () => {
    await store.record(entry({ repoName: 'GR-1', actor: 'alejo' }));
    await store.record(entry({ repoName: 'GR-2', actor: 'carlos', action: 'ova.updated' }));
    await store.record(entry({ repoName: 'AB-9', actor: 'carlos', action: 'ova.removed' }));

    expect((await store.listActivity({ action: 'ova.updated' }, 10, 0)).entries.map((e) => e.repoName)).toEqual(['GR-2']);
    expect((await store.listActivity({ search: 'gr-' }, 10, 0)).total).toBe(2);
    expect((await store.listActivity({ search: 'carlos' }, 10, 0)).total).toBe(2);
    expect((await store.listActivity({ search: 'carlos', action: 'ova.removed' }, 10, 0)).total).toBe(1);
  });

  it('trata % y _ de la búsqueda como texto literal', async () => {
    await store.record(entry({ repoName: 'GR-1' }));
    await store.record(entry({ repoName: 'GR_1' }));

    expect((await store.listActivity({ search: '_' }, 10, 0)).entries.map((e) => e.repoName)).toEqual(['GR_1']);
    expect((await store.listActivity({ search: '%' }, 10, 0)).total).toBe(0);
  });

  it('no falla si una fila tiene el detalle dañado', async () => {
    await store.record(entry());
    (store as unknown as { db: { prepare: (sql: string) => { run: () => void } } }).db
      .prepare("UPDATE audit_log SET details = 'no es json'")
      .run();

    const { entries } = await store.listActivity({}, 10, 0);

    expect(entries[0].details).toEqual({});
  });
});

describe('SqliteOvaStore · editar OVAs', () => {
  it('actualiza escuela y desarrollador, y devuelve null si la OVA no existe', async () => {
    const store = new SqliteOvaStore(':memory:');
    const ing = await store.addSchool({ name: 'Ingeniería', slug: 'ingenieria' });
    const letras = await store.addSchool({ name: 'Letras', slug: 'letras' });
    const juan = await store.addDeveloper({ name: 'Juan' });
    const maria = await store.addDeveloper({ name: 'María' });
    const ova = await store.add({ repoName: 'GR-1', repoUrl: 'u', schoolId: ing.id, developerId: juan.id, createdBy: 'a' });

    expect((await store.findById(ova.id))?.repoName).toBe('GR-1');
    expect(await store.findById(999)).toBeNull();

    const updated = await store.update(ova.id, { schoolId: letras.id, developerId: maria.id });
    expect(updated).toMatchObject({ school: { name: 'Letras' }, developer: { name: 'María' } });

    expect((await store.update(ova.id, {}))?.school.name).toBe('Letras');
    expect(await store.update(999, { schoolId: ing.id })).toBeNull();
    await expect(store.update(ova.id, { schoolId: 999 })).rejects.toThrow('does not exist');
    await expect(store.update(ova.id, { developerId: 999 })).rejects.toThrow('does not exist');
    store.close();
  });
});
