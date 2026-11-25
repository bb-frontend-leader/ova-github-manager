'use client';

import { ErrorPanel } from '@/components/error-panel';

/**
 * Falla una página fuera de un proyecto (lista de proyectos, crear o importar). Mantiene la cabecera
 * de la aplicación; los fallos del propio layout los recoge global-error.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} />;
}
