import { OVA_STATUSES, isOvaStatus, type OvaStatus } from '@/core/domain/OvaStatus';

export { OVA_STATUSES, isOvaStatus, type OvaStatus };

export const STATUS_LABELS: Record<OvaStatus, string> = {
  development: 'En desarrollo',
  review: 'En revisión',
  delivered: 'Entregada',
};

/** Plural, para los títulos de las columnas del tablero. */
export const STATUS_COLUMN_LABELS: Record<OvaStatus, string> = {
  development: 'En desarrollo',
  review: 'En revisión',
  delivered: 'Entregadas',
};

export const STATUS_HINTS: Record<OvaStatus, string> = {
  development: 'Se están construyendo',
  review: 'Terminadas, esperando revisión',
  delivered: 'Listas y entregadas',
};

/** Estado anterior y siguiente en el ciclo (null en los extremos). */
export function neighbours(status: OvaStatus): { previous: OvaStatus | null; next: OvaStatus | null } {
  const index = OVA_STATUSES.indexOf(status);
  return {
    previous: OVA_STATUSES[index - 1] ?? null,
    next: OVA_STATUSES[index + 1] ?? null,
  };
}

/** Lee `?status=` de la URL; cualquier valor desconocido se ignora. */
export function parseStatus(value: string | undefined): OvaStatus | undefined {
  return isOvaStatus(value) ? value : undefined;
}
