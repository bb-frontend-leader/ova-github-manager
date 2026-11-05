import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Alert } from '@/components/alert';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { requireProjectPermission } from '@/lib/dal';
import { parseId } from '@/lib/ova-filter';
import { updateOvaAction } from './actions';

export default async function EditOvaPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string; id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { project: slug, id: rawId } = await params;
  const { project, services } = await requireProjectPermission(slug, 'ova:edit');
  const base = `/p/${project.slug}`;

  const id = parseId(rawId);
  if (id === undefined) notFound();

  const { store } = services;
  const [ova, schools, developers] = await Promise.all([
    store.findById(id),
    store.listSchools(),
    store.listDevelopers(),
  ]);
  if (!ova) notFound();

  const { ok, error } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`${base}#ovas`}
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver al panel
      </Link>

      <PageHeader
        title={`Editar ${ova.repoName}`}
        description="Corrige la escuela o el desarrollador de esta OVA. El nombre del repositorio no cambia."
        actions={
          <a
            href={ova.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline' })}
          >
            Abrir en GitHub <ExternalLink aria-hidden />
            <span className="sr-only"> (pestaña nueva)</span>
          </a>
        }
      />

      {ok && <Alert variant="success" title={ok} />}
      {error && (
        <Alert variant="error" title="No se pudo guardar el cambio">
          {error}
        </Alert>
      )}

      <Card className="max-w-2xl">
        <CardContent>
          <form action={updateOvaAction} className="flex flex-col gap-5">
            <input type="hidden" name="project" value={project.slug} />
            <input type="hidden" name="id" value={ova.id} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schoolId">Escuela</Label>
              <NativeSelect id="schoolId" name="schoolId" required defaultValue={ova.school.id}>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Al cambiarla se actualiza también el topic del repositorio en GitHub (los demás topics se conservan).
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="developerId">Desarrollador</Label>
              <NativeSelect id="developerId" name="developerId" required defaultValue={ova.developer.id}>
                {developers.map((developer) => (
                  <option key={developer.id} value={developer.id}>
                    {developer.name}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">Solo cambia en el registro del panel, no en GitHub.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit">Guardar cambios</Button>
              <Link href={`${base}#ovas`} className={buttonVariants({ variant: 'ghost' })}>
                Cancelar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
