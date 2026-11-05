import 'server-only';
import type { ProjectRecord, SyncOvasResult } from '@/core';
import { getProjectServices } from './services';

/** Cada cuánto, como máximo, se concilia el registro con GitHub al abrir el panel de un proyecto. */
const INTERVAL_MS = 5 * 60 * 1000;
/** Si GitHub tarda más que esto, el panel se muestra igual con lo que hay registrado. */
const TIMEOUT_MS = 8000;

interface SyncState {
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  inflight: Promise<SyncOvasResult | null> | null;
}

// En globalThis para sobrevivir al hot reload y compartirse entre peticiones.
// Cada proyecto lleva su propio estado: sincronizar uno no pospone a los demás.
const globalForSync = globalThis as unknown as { __ovaSyncStates?: Map<number, SyncState> };

function state(projectId: number): SyncState {
  const states = (globalForSync.__ovaSyncStates ??= new Map());
  let current = states.get(projectId);
  if (!current) {
    current = { lastAttemptAt: 0, lastSuccessAt: null, inflight: null };
    states.set(projectId, current);
  }
  return current;
}

/** Momento (ms) de la última sincronización correcta del proyecto, o null si aún no hubo ninguna. */
export function lastSyncAt(projectId: number): number | null {
  return state(projectId).lastSuccessAt;
}

/** Marca una sincronización correcta hecha por otra vía (p. ej. el botón manual). */
export function markSynced(projectId: number): void {
  const s = state(projectId);
  s.lastAttemptAt = s.lastSuccessAt = Date.now();
}

/**
 * Sincroniza el proyecto con GitHub si pasaron más de 5 minutos desde el último intento.
 * Nunca lanza: si GitHub falla o tarda, devuelve null y el panel sigue con el registro actual.
 * Las visitas simultáneas comparten una sola sincronización.
 */
export async function autoSyncIfDue(project: ProjectRecord): Promise<SyncOvasResult | null> {
  const s = state(project.id);
  if (s.inflight) return s.inflight;
  if (Date.now() - s.lastAttemptAt < INTERVAL_MS) return null;

  s.lastAttemptAt = Date.now(); // también tras un fallo: no se reintenta en cada visita
  const run = getProjectServices(project)
    .syncOvas.execute()
    .then((result) => {
      s.lastSuccessAt = Date.now();
      return result;
    })
    .catch((error: unknown) => {
      console.error('[autoSync]', error);
      return null;
    });

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  s.inflight = Promise.race([run, timeout]).finally(() => {
    s.inflight = null;
  });
  return s.inflight;
}
