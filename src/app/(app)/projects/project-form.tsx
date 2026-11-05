'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProjectFormState, ProjectFormValues } from './actions';

type Action = (previous: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;

const EMPTY: ProjectFormValues = {
  name: '',
  org: '',
  slug: '',
  template: 'ova-template',
  defaultTeam: 'Frontend',
  descriptionPrefix: '',
  total: '',
};

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Formulario de proyecto, para crear y para editar. Al editar, la organización y el identificador
 * se muestran pero no cambian: los repositorios y las direcciones dependen de ellos.
 */
export function ProjectForm({
  action,
  initial = EMPTY,
  projectId,
  cancelHref,
  submitLabel,
}: {
  action: Action;
  initial?: ProjectFormValues;
  /** Presente solo al editar */
  projectId?: number;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(action, {
    status: 'idle',
  });
  const editing = projectId !== undefined;
  const values = state.status === 'error' ? state.values : initial;
  // Cada intento fallido remonta el formulario para conservar lo que la persona había escrito
  const formKey = state.status === 'error' ? state.attempt : 'initial';

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-5">
      {editing && <input type="hidden" name="projectId" value={projectId} />}

      {state.status === 'error' && (
        <Alert variant="error" title="No se pudo guardar el proyecto">
          {state.message}
        </Alert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Nombre del proyecto" hint="Es lo que se ve en la herramienta.">
          <Input
            id="name"
            name="name"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="625 OVAs 2027"
            defaultValue={values.name}
          />
        </Field>

        <Field
          id="org"
          label="Organización de GitHub"
          hint={
            editing
              ? 'No se puede cambiar: los repositorios ya viven en ella.'
              : 'Debe existir y el token de la herramienta debe tener acceso a ella.'
          }
        >
          <Input
            id="org"
            name="org"
            required
            autoComplete="off"
            placeholder="mi-organizacion"
            defaultValue={values.org}
            readOnly={editing}
            className={editing ? 'bg-muted' : undefined}
          />
        </Field>

        {!editing && (
          <Field
            id="slug"
            label="Identificador (opcional)"
            hint="Va en la dirección del proyecto: /p/identificador. Si lo dejas vacío se genera del nombre."
          >
            <Input id="slug" name="slug" autoComplete="off" placeholder="625-ovas-2027" defaultValue={values.slug} />
          </Field>
        )}

        <Field id="total" label="Objetivo de OVAs" hint="Cuántas OVAs debe llegar a tener el proyecto.">
          <Input
            id="total"
            name="total"
            type="number"
            min={1}
            max={100000}
            required
            inputMode="numeric"
            placeholder="625"
            defaultValue={values.total}
          />
        </Field>

        <Field
          id="template"
          label="Repositorio plantilla"
          hint='Nombre en la organización, o "dueño/repositorio" si está en otra. Debe estar marcado como "Template repository".'
        >
          <Input id="template" name="template" required autoComplete="off" defaultValue={values.template} />
        </Field>

        <Field id="defaultTeam" label="Team con acceso de escritura" hint="Recibe permiso de escritura (Write) en cada repositorio nuevo.">
          <Input id="defaultTeam" name="defaultTeam" required autoComplete="off" defaultValue={values.defaultTeam} />
        </Field>

        <Field
          id="descriptionPrefix"
          label="Prefijo de la descripción"
          hint="Cada repositorio queda descrito como «prefijo - nombre». Si lo dejas vacío usa el nombre del proyecto."
        >
          <Input
            id="descriptionPrefix"
            name="descriptionPrefix"
            autoComplete="off"
            maxLength={100}
            defaultValue={values.descriptionPrefix}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: 'ghost' })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
