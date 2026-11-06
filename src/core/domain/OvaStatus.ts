/**
 * Estado de una OVA en su ciclo de trabajo.
 * - development: se está construyendo
 * - review: terminada, en revisión
 * - delivered: entregada; ya no requiere seguimiento
 */
export const OVA_STATUSES = ['development', 'review', 'delivered'] as const;
export type OvaStatus = (typeof OVA_STATUSES)[number];

/** Toda OVA nace "en desarrollo". */
export const DEFAULT_OVA_STATUS: OvaStatus = 'development';

export function isOvaStatus(value: unknown): value is OvaStatus {
  return typeof value === 'string' && (OVA_STATUSES as readonly string[]).includes(value);
}

/** Una OVA entregada ya no necesita seguimiento (no se marca como estancada). */
export function isActiveStatus(status: OvaStatus): boolean {
  return status !== 'delivered';
}
