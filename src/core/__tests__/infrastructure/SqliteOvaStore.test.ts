import { DuplicateEntryError } from '../../application/errors';
import { SqliteOvaStore } from '../../infrastructure/sqlite';

describe('SqliteOvaStore', () => {
  let store: SqliteOvaStore;

  beforeEach(() => {
    store = new SqliteOvaStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  async function seed() {
    const ing = await store.addSchool({ name: 'Ingeniería', slug: 'ingenieria' });
    const letras = await store.addSchool({ name: 'Letras', slug: 'letras' });
    const juan = await store.addDeveloper({ name: 'Juan' });
    const maria = await store.addDeveloper({ name: 'María' });
    return { ing, letras, juan, maria };
  }

  describe('catálogo', () => {
    it('crea y lista escuelas ordenadas por nombre', async () => {
      await store.addSchool({ name: 'Letras', slug: 'letras' });
      await store.addSchool({ name: 'Artes', slug: 'artes' });

      const schools = await store.listSchools();

      expect(schools.map((s) => s.name)).toEqual(['Artes', 'Letras']);
      expect(schools[0]).toEqual({ id: expect.any(Number), name: 'Artes', slug: 'artes' });
    });

    it('encuentra una escuela por id y devuelve null si no existe', async () => {
      const school = await store.addSchool({ name: 'Letras', slug: 'letras' });

      expect(await store.findSchool(school.id)).toEqual(school);
      expect(await store.findSchool(999)).toBeNull();
    });

    it('rechaza escuelas duplicadas sin distinguir mayúsculas', async () => {
      await store.addSchool({ name: 'Letras', slug: 'letras' });

      await expect(store.addSchool({ name: 'LETRAS', slug: 'otro' })).rejects.toBeInstanceOf(
        DuplicateEntryError,
      );
    });

    it('rechaza escuelas con el mismo slug', async () => {
      await store.addSchool({ name: 'Letras', slug: 'letras' });

      await expect(store.addSchool({ name: 'Otra', slug: 'letras' })).rejects.toBeInstanceOf(
        DuplicateEntryError,
      );
    });

    it('crea, lista y encuentra desarrolladores', async () => {
      const juan = await store.addDeveloper({ name: 'Juan' });
      await store.addDeveloper({ name: 'Ana' });

      expect((await store.listDevelopers()).map((d) => d.name)).toEqual(['Ana', 'Juan']);
      expect(await store.findDeveloper(juan.id)).toEqual(juan);
      expect(await store.findDeveloper(999)).toBeNull();
    });

    it('rechaza desarrolladores duplicados sin distinguir mayúsculas', async () => {
      await store.addDeveloper({ name: 'Juan' });

      await expect(store.addDeveloper({ name: 'juan' })).rejects.toBeInstanceOf(
        DuplicateEntryError,
      );
    });
  });

  describe('registro de OVAs', () => {
    it('registra una OVA y devuelve el registro completo', async () => {
      const { ing, juan } = await seed();

      const ova = await store.add({
        repoName: 'GR-2-88-2027-1',
        repoUrl: 'https://github.com/org/GR-2-88-2027-1',
        schoolId: ing.id,
        developerId: juan.id,
        createdBy: 'alejo',
      });

      expect(ova).toEqual({
        id: expect.any(Number),
        repoName: 'GR-2-88-2027-1',
        repoUrl: 'https://github.com/org/GR-2-88-2027-1',
        school: ing,
        developer: juan,
        createdBy: 'alejo',
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
    });

    it('encuentra una OVA por nombre sin distinguir mayúsculas', async () => {
      const { ing, juan } = await seed();
      await store.add({
        repoName: 'GR-2-88-2027-1',
        repoUrl: 'u',
        schoolId: ing.id,
        developerId: juan.id,
        createdBy: 'a',
      });

      expect((await store.findByRepoName('gr-2-88-2027-1'))?.repoName).toBe('GR-2-88-2027-1');
      expect(await store.findByRepoName('no-existe')).toBeNull();
    });

    it('rechaza registrar dos veces la misma OVA', async () => {
      const { ing, juan } = await seed();
      const ova = { repoName: 'GR-1', repoUrl: 'u', schoolId: ing.id, developerId: juan.id, createdBy: 'a' };
      await store.add(ova);

      await expect(store.add({ ...ova, repoName: 'gr-1' })).rejects.toBeInstanceOf(
        DuplicateEntryError,
      );
    });

    it('quita una OVA del registro y avisa si no existía', async () => {
      const { ing, juan } = await seed();
      const ova = await store.add({
        repoName: 'GR-1',
        repoUrl: 'u',
        schoolId: ing.id,
        developerId: juan.id,
        createdBy: 'a',
      });

      expect(await store.remove(ova.id)).toBe(true);
      expect(await store.findByRepoName('GR-1')).toBeNull();
      expect(await store.remove(ova.id)).toBe(false);
    });

    it('rechaza una OVA con escuela o desarrollador inexistente', async () => {
      const { juan } = await seed();

      await expect(
        store.add({ repoName: 'GR-1', repoUrl: 'u', schoolId: 999, developerId: juan.id, createdBy: 'a' }),
      ).rejects.toThrow('School or developer does not exist');
    });

    it('lista las más recientes primero y filtra por escuela y desarrollador', async () => {
      const { ing, letras, juan, maria } = await seed();
      const base = { repoUrl: 'u', createdBy: 'a' };
      await store.add({ ...base, repoName: 'A', schoolId: ing.id, developerId: juan.id });
      await store.add({ ...base, repoName: 'B', schoolId: letras.id, developerId: juan.id });
      await store.add({ ...base, repoName: 'C', schoolId: ing.id, developerId: maria.id });

      expect((await store.list()).map((o) => o.repoName)).toEqual(['C', 'B', 'A']);
      expect((await store.list({ schoolId: ing.id })).map((o) => o.repoName)).toEqual(['C', 'A']);
      expect((await store.list({ developerId: juan.id })).map((o) => o.repoName)).toEqual(['B', 'A']);
      expect(
        (await store.list({ schoolId: ing.id, developerId: juan.id })).map((o) => o.repoName),
      ).toEqual(['A']);
    });

    it('calcula estadísticas incluyendo escuelas y desarrolladores sin OVAs', async () => {
      const { ing, letras, juan, maria } = await seed();
      await store.addSchool({ name: 'Artes', slug: 'artes' });
      const base = { repoUrl: 'u', createdBy: 'a' };
      await store.add({ ...base, repoName: 'A', schoolId: ing.id, developerId: juan.id });
      await store.add({ ...base, repoName: 'B', schoolId: ing.id, developerId: juan.id });
      await store.add({ ...base, repoName: 'C', schoolId: letras.id, developerId: juan.id });

      const stats = await store.stats();

      expect(stats.total).toBe(3);
      expect(stats.bySchool.map((s) => [s.school.name, s.count])).toEqual([
        ['Artes', 0],
        ['Ingeniería', 2],
        ['Letras', 1],
      ]);
      expect(stats.byDeveloper.map((d) => [d.developer.name, d.count])).toEqual([
        ['Juan', 3],
        ['María', 0],
      ]);
      expect(maria.id).toBeGreaterThan(0);
    });

    it('devuelve estadísticas vacías sin datos', async () => {
      expect(await store.stats()).toEqual({ total: 0, bySchool: [], byDeveloper: [] });
    });
  });
});
