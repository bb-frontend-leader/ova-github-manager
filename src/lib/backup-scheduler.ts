import 'server-only';

/** Cada cuánto se comprueba si toca una copia (la copia en sí se hace según BACKUP_INTERVAL_HOURS). */
const CHECK_EVERY_MS = 30 * 60 * 1000;
/** Pequeña espera inicial para no competir con las primeras peticiones. */
const FIRST_CHECK_DELAY_MS = 10_000;

export interface BackupFailure {
  /** ISO 8601, UTC */
  at: string;
  message: string;
}

// En globalThis para sobrevivir al hot reload: un solo temporizador por proceso
const globalForBackups = globalThis as unknown as {
  __ovaBackupTimer?: NodeJS.Timeout;
  __ovaBackupFailure?: BackupFailure | null;
};

/** Último fallo de una copia automática (null si la última salió bien o aún no hubo ninguna). */
export function lastBackupFailure(): BackupFailure | null {
  return globalForBackups.__ovaBackupFailure ?? null;
}

export function recordBackupSuccess(): void {
  globalForBackups.__ovaBackupFailure = null;
}

export function recordBackupFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('[backup]', error);
  globalForBackups.__ovaBackupFailure = { at: new Date().toISOString(), message };
}

/**
 * Empieza a comprobar periódicamente si toca una copia. `run` hace la comprobación y la copia
 * si corresponde; nunca debe tumbar el servidor, así que sus errores solo se registran.
 * Llamarlo varias veces no duplica el temporizador.
 */
export function startBackupScheduler(run: () => Promise<unknown>): void {
  if (globalForBackups.__ovaBackupTimer) return;

  const tick = () => {
    run().then(
      (result) => {
        // `null` = no tocaba; no es un éxito ni un fallo nuevo
        if (result) recordBackupSuccess();
      },
      (error: unknown) => recordBackupFailure(error),
    );
  };

  setTimeout(tick, FIRST_CHECK_DELAY_MS).unref();
  // unref: el temporizador no impide que el proceso termine
  globalForBackups.__ovaBackupTimer = setInterval(tick, CHECK_EVERY_MS);
  globalForBackups.__ovaBackupTimer.unref();
}
