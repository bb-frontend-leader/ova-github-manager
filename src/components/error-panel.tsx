'use client';

import { useEffect } from 'react';
import { Alert } from '@/components/alert';
import { Button } from '@/components/ui/button';

/**
 * Contenido común de las pantallas de error (error.tsx y global-error.tsx): mensaje, referencia
 * para localizar el fallo en los logs del servidor y un botón para reintentar.
 */
export function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  const digest =
    error instanceof Error && 'digest' in error && typeof error.digest === 'string' ? error.digest : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="error" title="No se pudo cargar esta página" className="w-full">
        Ocurrió un problema al obtener los datos. Puedes intentarlo de nuevo.
        {digest && <span className="mt-1 block text-xs text-muted-foreground">Referencia: {digest}</span>}
      </Alert>
      <Button type="button" variant="secondary" onClick={() => retry()}>
        Reintentar
      </Button>
    </div>
  );
}
