import 'server-only';
import type { OvaHealth, OvaHealthReport, RepositoryHealth, RepositoryInspector } from '@/core';
import { translateError } from './messages';
import type { ProjectServices } from './services';

/** Los datos de GitHub se reutilizan este tiempo: abrir el panel y el tablero no repite las consultas. */
const TTL_MS = 3 * 60 * 1000;
/** Si GitHub tarda más, la página se muestra sin los datos de actividad. */
const TIMEOUT_MS = 10_000;

interface CacheEntry {
  at: number;
  data: RepositoryHealth[];
}

// En globalThis para sobrevivir al hot reload y compartirse entre peticiones
const globalForHealth = globalThis as unknown as {
  __ovaHealthCache?: Map<string, CacheEntry>;
  __ovaHealthInflight?: Map<string, Promise<RepositoryHealth[]>>;
};

/**
 * Envuelve la consulta de salud con una caché por organización y evita consultas simultáneas
 * repetidas. Solo guarda lo que viene de GitHub: el cruce con el registro (estado, desarrollador)
 * se hace siempre sobre datos al día.
 */
export function cachedInspector(
  inspector: Pick<RepositoryInspector, 'listRepositoryHealth'>,
): Pick<RepositoryInspector, 'listRepositoryHealth'> {
  return {
    async listRepositoryHealth(org) {
      const key = org.toLowerCase();
      const cache = (globalForHealth.__ovaHealthCache ??= new Map());
      const inflight = (globalForHealth.__ovaHealthInflight ??= new Map());

      const cached = cache.get(key);
      if (cached && Date.now() - cached.at < TTL_MS) return cached.data;

      let pending = inflight.get(key);
      if (!pending) {
        pending = inspector
          .listRepositoryHealth(org)
          .then((data) => {
            cache.set(key, { at: Date.now(), data });
            return data;
          })
          .finally(() => inflight.delete(key));
        inflight.set(key, pending);
      }
      return pending;
    },
  };
}

export type HealthResult =
  | { ok: true; report: OvaHealthReport; byOvaId: Map<number, OvaHealth> }
  | { ok: false; error: string };

/** Nunca lanza: si GitHub falla o tarda, la página se muestra igual y explica que no hay datos. */
export async function loadHealth(services: ProjectServices, now: number): Promise<HealthResult> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Failed to read repository health: timed out')), TIMEOUT_MS),
    );
    const report = await Promise.race([services.health.execute(now), timeout]);
    return { ok: true, report, byOvaId: new Map(report.items.map((item) => [item.ova.id, item])) };
  } catch (error) {
    console.error('[loadHealth]', error);
    return { ok: false, error: translateError(error) };
  }
}
