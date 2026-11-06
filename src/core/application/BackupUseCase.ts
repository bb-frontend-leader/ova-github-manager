/**
 * Copias de seguridad de la base de datos.
 * La aplicación solo conoce este puerto; cómo se copia y dónde se guarda lo decide la infraestructura.
 */

export interface BackupSnapshot {
  /** Nombre del archivo de la copia */
  name: string;
  /** Cuándo se hizo. ISO 8601, UTC */
  createdAt: string;
  sizeBytes: number;
}

export interface DatabaseBackup {
  /** Hace una copia consistente (aunque la base esté en uso) y comprueba que se puede leer. */
  create(now: Date): Promise<BackupSnapshot>;
  /** Más recientes primero */
  list(): Promise<BackupSnapshot[]>;
  /** Deja solo las `keep` más recientes. Devuelve los nombres de las que borró. */
  prune(keep: number): Promise<string[]>;
}

export interface BackupConfig {
  /** Cada cuánto debe haber una copia, en milisegundos. 0 = sin copias automáticas */
  intervalMs: number;
  /** Cuántas copias se conservan (mínimo 1) */
  keep: number;
}

export interface BackupResult {
  snapshot: BackupSnapshot;
  /** Copias antiguas que se borraron al aplicar la retención */
  pruned: string[];
}

export interface BackupStatus {
  enabled: boolean;
  intervalMs: number;
  keep: number;
  /** Más recientes primero */
  snapshots: BackupSnapshot[];
  latest: BackupSnapshot | null;
  /** Cuándo toca la próxima copia automática (ISO); null si están desactivadas */
  nextDueAt: string | null;
}

/**
 * Hace copias de seguridad periódicas y conserva solo las más recientes.
 * Es seguro llamarlo a menudo: `runIfDue` no copia si la última es reciente.
 */
export class BackupUseCase {
  constructor(
    private readonly backup: DatabaseBackup,
    private readonly config: BackupConfig,
  ) {}

  get enabled(): boolean {
    return this.config.intervalMs > 0;
  }

  /** Copia ahora, sin mirar cuándo fue la última, y aplica la retención. */
  async runNow(now: Date = new Date()): Promise<BackupResult> {
    const snapshot = await this.backup.create(now);
    const pruned = await this.backup.prune(Math.max(1, this.config.keep));
    return { snapshot, pruned };
  }

  /** Copia solo si las copias automáticas están activas y la última ya tiene más del intervalo. */
  async runIfDue(now: Date = new Date()): Promise<BackupResult | null> {
    if (!this.enabled) return null;
    const [latest] = await this.backup.list();
    if (latest && now.getTime() - new Date(latest.createdAt).getTime() < this.config.intervalMs) {
      return null;
    }
    return this.runNow(now);
  }

  async status(): Promise<BackupStatus> {
    const snapshots = await this.backup.list();
    const latest = snapshots[0] ?? null;
    const nextDueAt =
      this.enabled && latest
        ? new Date(new Date(latest.createdAt).getTime() + this.config.intervalMs).toISOString()
        : null;
    return {
      enabled: this.enabled,
      intervalMs: this.config.intervalMs,
      keep: Math.max(1, this.config.keep),
      snapshots,
      latest,
      nextDueAt,
    };
  }
}
