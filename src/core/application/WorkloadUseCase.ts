import { isActiveStatus } from '../domain/OvaStatus';
import type { Catalog, DeveloperRecord, OvaRegistry } from './registry';

/**
 * Carga de trabajo por desarrollador: cuántas OVAs lleva en cada estado y quién tiene hueco.
 * "Carga" = OVAs activas (en desarrollo o en revisión); las entregadas ya no cuentan.
 */

/** Cuánto por encima o por debajo del promedio de OVAs activas se considera "mucha" o "poca" carga. */
export const HIGH_LOAD_FACTOR = 1.5;
export const LOW_LOAD_FACTOR = 0.5;
/** Además del factor, hace falta una diferencia mínima de OVAs: con promedios chicos, 1 de diferencia no es nada. */
export const MIN_LOAD_GAP = 2;

export type LoadLevel = 'high' | 'normal' | 'low';

export interface DeveloperLoad {
  developer: DeveloperRecord;
  development: number;
  review: number;
  delivered: number;
  /** En desarrollo + en revisión */
  active: number;
  total: number;
  /** OVAs activas estancadas; null si no se tienen datos de actividad */
  stalled: number | null;
  /** Activas menos el promedio del equipo (con un decimal) */
  vsAverage: number;
  level: LoadLevel;
}

export interface WorkloadReport {
  /** Más carga primero; a igual carga, por nombre */
  developers: DeveloperLoad[];
  /** Promedio de OVAs activas entre todos los desarrolladores del catálogo (con un decimal) */
  averageActive: number;
  totalActive: number;
  /** Cuántos desarrolladores no llevan ninguna OVA activa */
  withoutLoad: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function loadLevel(active: number, average: number): LoadLevel {
  if (average <= 0) return 'normal';
  if (active >= average * HIGH_LOAD_FACTOR && active - average >= MIN_LOAD_GAP) return 'high';
  if (active <= average * LOW_LOAD_FACTOR && average - active >= MIN_LOAD_GAP) return 'low';
  return 'normal';
}

export class WorkloadUseCase {
  constructor(
    private readonly registry: Pick<OvaRegistry, 'list'>,
    private readonly catalog: Pick<Catalog, 'listDevelopers'>,
  ) {}

  /** `stalledIds`: OVAs estancadas, si se conocen (null = sin datos de actividad). */
  async execute(stalledIds: ReadonlySet<number> | null = null): Promise<WorkloadReport> {
    const [ovas, developers] = await Promise.all([this.registry.list(), this.catalog.listDevelopers()]);

    const loads = new Map<number, Omit<DeveloperLoad, 'vsAverage' | 'level'>>(
      developers.map((developer) => [
        developer.id,
        {
          developer,
          development: 0,
          review: 0,
          delivered: 0,
          active: 0,
          total: 0,
          stalled: stalledIds === null ? null : 0,
        },
      ]),
    );

    for (const ova of ovas) {
      const load = loads.get(ova.developer.id);
      if (!load) continue;
      load[ova.status] += 1;
      load.total += 1;
      if (isActiveStatus(ova.status)) {
        load.active += 1;
        if (stalledIds?.has(ova.id)) load.stalled = (load.stalled ?? 0) + 1;
      }
    }

    const all = [...loads.values()];
    const totalActive = all.reduce((sum, load) => sum + load.active, 0);
    const average = all.length === 0 ? 0 : totalActive / all.length;

    const result = all
      .map(
        (load): DeveloperLoad => ({
          ...load,
          vsAverage: round1(load.active - average),
          level: loadLevel(load.active, average),
        }),
      )
      .sort((a, b) => b.active - a.active || a.developer.name.localeCompare(b.developer.name, 'es'));

    return {
      developers: result,
      averageActive: round1(average),
      totalActive,
      withoutLoad: result.filter((load) => load.active === 0).length,
    };
  }
}
