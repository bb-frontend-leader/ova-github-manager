import type { OvaStatus } from '../domain/OvaStatus';
import type { OvaRecord } from './registry';

const STATUS_LABELS: Record<OvaStatus, string> = {
  development: 'En desarrollo',
  review: 'En revisión',
  delivered: 'Entregada',
};

/**
 * Separador de columnas. El punto y coma es el que Excel espera por defecto con la
 * configuración regional en español (donde la coma es el separador decimal).
 */
export const CSV_SEPARATOR = ';';

const HEADERS = [
  'Repositorio',
  'Enlace del repositorio',
  'Escuela',
  'Topic',
  'Desarrollador',
  'Estado',
  'Creada por',
  'Fecha de creación (UTC)',
] as const;

/** Escapa una celda: comillas si hace falta y sin que una hoja de cálculo la ejecute como fórmula. */
function cell(value: string): string {
  // Una celda que empieza por = + - @ se interpretaría como fórmula al abrirla en Excel
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Convierte las OVAs a CSV (líneas CRLF), con el enlace de cada repositorio. */
export function ovasToCsv(ovas: readonly OvaRecord[]): string {
  const rows = ovas.map((ova) => [
    ova.repoName,
    ova.repoUrl,
    ova.school.name,
    ova.school.slug,
    ova.developer.name,
    STATUS_LABELS[ova.status],
    ova.createdBy,
    ova.createdAt,
  ]);
  return [HEADERS as readonly string[], ...rows]
    .map((row) => row.map(cell).join(CSV_SEPARATOR))
    .join('\r\n')
    .concat('\r\n');
}
