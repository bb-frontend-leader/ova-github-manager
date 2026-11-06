'use client';

import { DatabaseBackup } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

/** Botón de envío con estado de carga; debe ir dentro de un <form>. */
export function BackupButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <DatabaseBackup className={pending ? 'animate-pulse' : undefined} aria-hidden />
      {pending ? 'Copiando…' : 'Hacer copia ahora'}
    </Button>
  );
}
