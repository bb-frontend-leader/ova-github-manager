import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, FolderPlus, FolderOpen, Upload } from 'lucide-react';
import { Alert } from '@/components/alert';
import { Meter } from '@/components/dataviz/meter';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireViewer } from '@/lib/dal';
import { getProjectServices } from '@/lib/services';
import { BackupsCard } from './backups-card';

export const metadata = { title: 'Proyectos' };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; ok?: string; backupOk?: string; backupError?: string }>;
}) {
  const viewer = await requireViewer();
  const { denied, ok, backupOk, backupError } = await searchParams;

  // Quien solo pertenece a un proyecto va directo a él
  if (!viewer.superAdmin && viewer.projects.length === 1 && !denied && !ok) {
    redirect(`/p/${viewer.projects[0].slug}`);
  }

  const cards = await Promise.all(
    viewer.projects.map(async (project) => ({
      project,
      total: (await getProjectServices(project).store.stats()).total,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proyectos"
        description="Cada proyecto es una organización de GitHub con sus propias OVAs, escuelas, desarrolladores y usuarios."
        actions={
          viewer.superAdmin && (
            <>
              <Link href="/projects/import" className={buttonVariants({ variant: 'outline' })}>
                <Upload aria-hidden /> Importar proyecto
              </Link>
              <Link href="/projects/new" className={buttonVariants()}>
                <FolderPlus aria-hidden /> Nuevo proyecto
              </Link>
            </>
          )
        }
      />

      {ok && <Alert variant="success" title={ok} />}
      {denied && (
        <Alert variant="error" title="No tienes acceso a esa sección">
          Solo un super administrador puede gestionar los proyectos.
        </Alert>
      )}

      {cards.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderOpen}
            title="Todavía no hay proyectos"
            description="Crea el primero indicando la organización de GitHub donde vivirán sus OVAs."
            action={
              <Link href="/projects/new" className={buttonVariants()}>
                Crear el primer proyecto
              </Link>
            }
          />
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ project, total }) => (
            <li key={project.id}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>
                    Organización <span className="font-medium text-foreground">{project.org}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col justify-between gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tabular-nums">{total}</span>
                      <span className="text-muted-foreground tabular-nums">de {project.total} OVAs</span>
                    </p>
                    <Meter value={total} max={project.total} label={`OVAs de ${project.name}`} />
                  </div>
                  <Link
                    href={`/p/${project.slug}`}
                    className={buttonVariants({ variant: 'outline', className: 'w-fit' })}
                  >
                    Abrir <ArrowRight aria-hidden />
                    <span className="sr-only"> {project.name}</span>
                  </Link>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {viewer.superAdmin && <BackupsCard backupOk={backupOk === '1'} backupError={backupError} />}
    </div>
  );
}
