'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CircleCheck, Lock, Plus } from 'lucide-react';
import { RepositoryName } from '@/core/domain/RepositoryName';
import { Alert } from '@/components/alert';
import { CopyButton } from '@/components/copy-button';
import { NativeSelect } from '@/components/native-select';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { translateError } from '@/lib/messages';
import { createOvaAction, type CreateOvaState } from './actions';

interface School {
  id: number;
  name: string;
  slug: string;
}
interface Developer {
  id: number;
  name: string;
}
interface Config {
  /** Identificador del proyecto (va en la URL y en el formulario) */
  project: string;
  org: string;
  template: string;
  team: string;
  prefix: string;
}

type NameCheck = { state: 'empty' } | { state: 'valid'; value: string } | { state: 'invalid'; message: string };

function checkName(raw: string): NameCheck {
  if (raw.trim() === '') return { state: 'empty' };
  try {
    return { state: 'valid', value: RepositoryName.create(raw).getValue() };
  } catch (error) {
    return { state: 'invalid', message: translateError(error) };
  }
}

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

const PLACEHOLDER = <span className="text-muted-foreground">Pendiente</span>;

/** Una "ronda" = una OVA. Para crear otra se remonta con otra key y todo queda en blanco. */
function OvaRound({
  schools,
  developers,
  config,
  onAnother,
  autoFocusName,
}: {
  schools: School[];
  developers: Developer[];
  config: Config;
  onAnother: () => void;
  autoFocusName: boolean;
}) {
  const [state, formAction, pending] = useActionState<CreateOvaState, FormData>(createOvaAction, {
    status: 'idle',
  });
  const [rawName, setRawName] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [developerId, setDeveloperId] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocusName) nameRef.current?.focus();
  }, [autoFocusName]);

  const name = checkName(rawName);
  const school = schools.find((s) => String(s.id) === schoolId);
  const developer = developers.find((d) => String(d.id) === developerId);
  const changed = name.state === 'valid' && name.value !== rawName.trim();

  if (state.status === 'success') {
    const text = `Link del repositorio: ${state.url}`;
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        <Alert variant="success" title={`OVA creada: ${state.repoName}`}>
          El repositorio ya está en GitHub y quedó registrado en el panel.
        </Alert>

        {state.warnings.length > 0 && (
          <Alert variant="warning" title="La OVA se creó, pero un paso no terminó">
            <ul className="list-disc pl-5">
              {state.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Card size="sm">
          <CardHeader>
            <CardTitle>Link del repositorio</CardTitle>
            <CardAction>
              <CopyButton text={text} label="Copiar" />
            </CardAction>
          </CardHeader>
          <CardContent>
            <a
              href={state.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm break-all text-link underline underline-offset-4"
            >
              {state.url}
            </a>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onAnother}>
            <Plus aria-hidden /> Crear otra OVA
          </Button>
          <Link href={`/p/${config.project}#ovas`} className={buttonVariants({ variant: 'outline' })}>
            Ver en el panel
          </Link>
        </div>
      </div>
    );
  }

  const nameError = name.state === 'invalid' ? name.message : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <Card>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-5">
            <input type="hidden" name="project" value={config.project} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rawName">Nombre de la OVA</Label>
              <Input
                ref={nameRef}
                id="rawName"
                name="rawName"
                value={rawName}
                onChange={(event) => setRawName(event.target.value)}
                placeholder="GR 2_88-2027-1"
                autoComplete="off"
                required
                aria-invalid={nameError ? true : undefined}
                aria-describedby="rawName-help"
              />
              <p
                id="rawName-help"
                role={nameError ? 'alert' : undefined}
                className={nameError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
              >
                {nameError ??
                  'Los espacios y guiones bajos se convierten en guiones. Ejemplo: GR 2_88-2027-1 → GR-2-88-2027-1.'}
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schoolId">Escuela</Label>
                <NativeSelect
                  id="schoolId"
                  name="schoolId"
                  required
                  value={schoolId}
                  onChange={(event) => setSchoolId(event.target.value)}
                >
                  <option value="" disabled>
                    Selecciona una escuela
                  </option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">Se añade como topic del repositorio.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="developerId">Desarrollador</Label>
                <NativeSelect
                  id="developerId"
                  name="developerId"
                  required
                  value={developerId}
                  onChange={(event) => setDeveloperId(event.target.value)}
                >
                  <option value="" disabled>
                    Selecciona un desarrollador
                  </option>
                  {developers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">Queda solo en el registro del panel.</p>
              </div>
            </div>

            {state.status === 'error' && (
              <Alert variant="error" title="No se pudo crear la OVA">
                {state.message}
              </Alert>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending || name.state === 'invalid'}>
                {pending ? 'Creando en GitHub…' : 'Crear OVA'}
              </Button>
              {pending && <p className="text-sm text-muted-foreground">Esto puede tardar unos segundos.</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-20" aria-label="Vista previa">
        <CardHeader>
          <CardTitle>Vista previa</CardTitle>
          <CardDescription>Esto es lo que se creará en GitHub.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <PreviewRow label="Repositorio">
              {name.state === 'valid' ? (
                <>
                  <span className="text-muted-foreground">{config.org}/</span>
                  <span className="font-medium">{name.value}</span>
                  {changed && <span className="mt-0.5 block text-xs text-muted-foreground">Nombre normalizado</span>}
                </>
              ) : (
                PLACEHOLDER
              )}
            </PreviewRow>
            <PreviewRow label="Escuela">
              {school ? (
                <>
                  {school.name}
                  <span className="mt-0.5 block text-xs text-muted-foreground">topic: {school.slug}</span>
                </>
              ) : (
                PLACEHOLDER
              )}
            </PreviewRow>
            <PreviewRow label="Desarrollador">{developer ? developer.name : PLACEHOLDER}</PreviewRow>
            <PreviewRow label="Plantilla">{config.template}</PreviewRow>
            <PreviewRow label="Equipo">
              {config.team}
              <span className="mt-0.5 block text-xs text-muted-foreground">Permiso de escritura</span>
            </PreviewRow>
            <PreviewRow label="Descripción">
              {name.state === 'valid' ? (
                <>
                  {config.prefix} - {name.value} <span className="text-muted-foreground">+ emoji</span>
                </>
              ) : (
                PLACEHOLDER
              )}
            </PreviewRow>
            <PreviewRow label="Visibilidad">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" aria-hidden /> Privado
              </span>
            </PreviewRow>
          </dl>
          {name.state === 'valid' && school && developer && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
              <CircleCheck className="size-3.5" aria-hidden /> Todo listo para crear
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function NewOvaForm(props: { schools: School[]; developers: Developer[]; config: Config }) {
  const [round, setRound] = useState(0);
  return (
    <OvaRound
      key={round}
      {...props}
      autoFocusName={round > 0}
      onAnother={() => setRound((current) => current + 1)}
    />
  );
}
