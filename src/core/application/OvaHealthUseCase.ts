import { isActiveStatus } from '../domain/OvaStatus';
import type { RepositoryHealth, RepositoryInspector } from './ports';
import type { OvaRecord, OvaRegistry } from './registry';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Días sin actividad a partir de los cuales una OVA en curso se considera estancada. */
export const DEFAULT_STALE_AFTER_DAYS = 10;

export interface OvaHealth {
  ova: OvaRecord;
  /** null si GitHub no devolvió datos de ese repositorio */
  health: RepositoryHealth | null;
  /** Días completos desde el último push (o desde que se creó, si el repo está vacío) */
  idleDays: number;
  /** En curso (no entregada) y sin actividad desde hace `staleAfterDays` o más */
  stalled: boolean;
}

export interface OvaHealthReport {
  items: OvaHealth[];
  staleAfterDays: number;
}

export interface OvaHealthConfig {
  org: string;
  staleAfterDays?: number;
}

/** Cruza el registro con la actividad de cada repositorio para detectar OVAs estancadas. */
export class OvaHealthUseCase {
  constructor(
    private readonly inspector: Pick<RepositoryInspector, 'listRepositoryHealth'>,
    private readonly registry: OvaRegistry,
    private readonly config: OvaHealthConfig,
  ) {}

  /** `now` en milisegundos; se puede fijar para que el resultado sea reproducible. */
  async execute(now: number = Date.now()): Promise<OvaHealthReport> {
    const staleAfterDays = this.config.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
    const [ovas, repos] = await Promise.all([
      this.registry.list(),
      this.inspector.listRepositoryHealth(this.config.org),
    ]);
    const byName = new Map(repos.map((repo) => [repo.name.toLowerCase(), repo]));

    const items = ovas.map((ova): OvaHealth => {
      const health = byName.get(ova.repoName.toLowerCase()) ?? null;
      // Un repo vacío no tiene push: se cuenta desde que se creó la OVA
      const lastActivity = new Date(health?.pushedAt ?? ova.createdAt).getTime();
      const idleDays = Math.max(0, Math.floor((now - lastActivity) / DAY_MS));
      return {
        ova,
        health,
        idleDays,
        stalled: isActiveStatus(ova.status) && idleDays >= staleAfterDays,
      };
    });

    return { items, staleAfterDays };
  }
}
