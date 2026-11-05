'use client';

import { RefreshCw } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

/** Botón de envío con estado de carga; debe ir dentro de un <form>. */
export function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <RefreshCw className={pending ? 'animate-spin' : undefined} aria-hidden />
      {pending ? 'Sincronizando…' : 'Sincronizar con GitHub'}
    </Button>
  );
}
