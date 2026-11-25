'use client';

import { ErrorPanel } from '@/components/error-panel';

/**
 * Qué se ve si falla la carga de una página del proyecto (p. ej. GitHub o la base de datos no
 * responden). Envuelve la página y su estado de carga, pero no el layout: la navegación sigue ahí.
 */
export default function ProjectPageError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorPanel error={error} retry={retry} />;
}
