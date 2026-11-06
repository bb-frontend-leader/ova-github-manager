import {
  BackupUseCase,
  type BackupSnapshot,
  type DatabaseBackup,
} from '../../application/BackupUseCase';

const HOUR = 60 * 60 * 1000;
const T0 = new Date('2026-11-06T10:00:00.000Z');
const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);

/** Respaldo en memoria: guarda los nombres y respeta la retención como el real. */
class FakeBackup implements DatabaseBackup {
  snapshots: BackupSnapshot[] = [];
  create = jest.fn(async (now: Date) => {
    const snapshot = { name: `copia-${now.toISOString()}`, createdAt: now.toISOString(), sizeBytes: 100 };
    this.snapshots.unshift(snapshot);
    return snapshot;
  });
  list = jest.fn(async () => [...this.snapshots]);
  prune = jest.fn(async (keep: number) => this.snapshots.splice(keep).map((s) => s.name));
}

describe('BackupUseCase', () => {
  let fake: FakeBackup;
  const make = (intervalHours = 24, keep = 3) =>
    new BackupUseCase(fake, { intervalMs: intervalHours * HOUR, keep });

  beforeEach(() => {
    fake = new FakeBackup();
  });

  describe('runNow', () => {
    it('hace una copia y aplica la retención', async () => {
      const useCase = make(24, 2);
      await useCase.runNow(at(0));
      await useCase.runNow(at(1));

      const { snapshot, pruned } = await useCase.runNow(at(2));

      expect(snapshot.createdAt).toBe(at(2).toISOString());
      expect(pruned).toHaveLength(1);
      expect(fake.snapshots).toHaveLength(2);
      expect(fake.prune).toHaveBeenLastCalledWith(2);
    });

    it('nunca conserva menos de una copia, aunque se configure 0', async () => {
      const useCase = make(24, 0);

      await useCase.runNow(at(0));
      await useCase.runNow(at(1));

      expect(fake.prune).toHaveBeenLastCalledWith(1);
      expect(fake.snapshots).toHaveLength(1);
    });

    it('copia aunque las copias automáticas estén desactivadas (es una orden manual)', async () => {
      const useCase = make(0);

      await useCase.runNow(at(0));

      expect(fake.snapshots).toHaveLength(1);
    });

    it('usa la hora actual si no se indica', async () => {
      const { snapshot } = await make().runNow();

      expect(Math.abs(Date.now() - new Date(snapshot.createdAt).getTime())).toBeLessThan(5000);
    });

    it('si la copia falla, no borra ninguna de las existentes', async () => {
      const useCase = make(24, 1);
      await useCase.runNow(at(0));
      fake.create.mockRejectedValueOnce(new Error('disco lleno'));

      await expect(useCase.runNow(at(1))).rejects.toThrow('disco lleno');

      expect(fake.snapshots).toHaveLength(1);
      expect(fake.prune).toHaveBeenCalledTimes(1); // solo la de la primera copia
    });
  });

  describe('runIfDue', () => {
    it('hace la primera copia si todavía no hay ninguna', async () => {
      const result = await make().runIfDue(at(0));

      expect(result?.snapshot.createdAt).toBe(at(0).toISOString());
    });

    it('no copia si la última es más reciente que el intervalo', async () => {
      const useCase = make(24);
      await useCase.runNow(at(0));

      expect(await useCase.runIfDue(at(23))).toBeNull();
      expect(fake.snapshots).toHaveLength(1);
    });

    it('copia cuando se cumple el intervalo', async () => {
      const useCase = make(24);
      await useCase.runNow(at(0));

      expect(await useCase.runIfDue(at(24))).not.toBeNull();
      expect(fake.snapshots).toHaveLength(2);
    });

    it('con las copias desactivadas nunca copia', async () => {
      const useCase = make(0);

      expect(useCase.enabled).toBe(false);
      expect(await useCase.runIfDue(at(1000))).toBeNull();
      expect(fake.create).not.toHaveBeenCalled();
    });

    it('usa la hora actual si no se indica', async () => {
      expect(await make().runIfDue()).not.toBeNull();
    });
  });

  describe('status', () => {
    it('sin copias: no hay última ni próxima fecha', async () => {
      const status = await make().status();

      expect(status).toMatchObject({ enabled: true, latest: null, nextDueAt: null, snapshots: [] });
    });

    it('con copias: indica la última, la cantidad y cuándo toca la próxima', async () => {
      const useCase = make(24, 5);
      await useCase.runNow(at(0));
      await useCase.runNow(at(3));

      const status = await useCase.status();

      expect(status.latest?.createdAt).toBe(at(3).toISOString());
      expect(status.snapshots).toHaveLength(2);
      expect(status.nextDueAt).toBe(at(27).toISOString());
      expect(status).toMatchObject({ enabled: true, keep: 5, intervalMs: 24 * HOUR });
    });

    it('desactivadas: no anuncia próxima copia', async () => {
      const useCase = make(0);
      await useCase.runNow(at(0));

      const status = await useCase.status();

      expect(status.enabled).toBe(false);
      expect(status.nextDueAt).toBeNull();
      expect(status.latest).not.toBeNull();
    });
  });
});
