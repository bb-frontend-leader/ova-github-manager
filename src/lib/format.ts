const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const absoluteFormat = new Intl.DateTimeFormat('es', { dateStyle: 'long', timeStyle: 'short' });
const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

/** Hora del servidor al renderizar; las páginas son dinámicas, así que cada visita la recalcula. */
export function currentTime(): number {
  return Date.now();
}

/** "512 B", "48,3 KB", "2,1 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
}

/** "hace un momento", "hace 3 horas", "ayer", "hace 2 meses"… */
export function relativeDate(iso: string, now: number): string {
  const diffMs = new Date(iso).getTime() - now;
  const days = Math.round(diffMs / DAY_MS);
  if (Math.abs(days) < 1) {
    const hours = Math.round(diffMs / HOUR_MS);
    return Math.abs(hours) < 1 ? 'hace un momento' : relativeFormat.format(hours, 'hour');
  }
  if (Math.abs(days) < 30) return relativeFormat.format(days, 'day');
  if (Math.abs(days) < 365) return relativeFormat.format(Math.round(days / 30), 'month');
  return relativeFormat.format(Math.round(days / 365), 'year');
}
