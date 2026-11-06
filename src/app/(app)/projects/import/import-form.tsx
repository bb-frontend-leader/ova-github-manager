'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { Alert } from '@/components/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { importProjectAction, type ImportFormState } from '../actions';

/** Sube el archivo de un proyecto exportado y crea un proyecto nuevo con su contenido. */
export function ImportForm() {
  const [state, formAction, pending] = useActionState<ImportFormState, FormData>(importProjectAction, {
    status: 'idle',
  });
  // Cada intento fallido remonta el formulario para conservar el identificador escrito
  const key = state.status === 'error' ? state.attempt : 'initial';

  return (
    <form key={key} action={formAction} className="flex flex-col gap-5">
      {state.status === 'error' && (
        <Alert variant="error" title="No se pudo importar el proyecto">
          {state.message}
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">Archivo del proyecto</Label>
        <Input id="file" name="file" type="file" accept=".json,application/json" required />
        <p className="text-xs text-muted-foreground">
          El .json que se descarga con «Exportar proyecto» (hasta 8 MB).
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="slug">Identificador nuevo (opcional)</Label>
        <Input
          id="slug"
          name="slug"
          defaultValue={state.status === 'error' ? state.slug : ''}
          placeholder="Déjalo vacío para usar el del archivo"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          Solo si ya hay un proyecto con el mismo identificador. Minúsculas, números y guiones.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          <Upload aria-hidden /> {pending ? 'Importando…' : 'Importar proyecto'}
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
