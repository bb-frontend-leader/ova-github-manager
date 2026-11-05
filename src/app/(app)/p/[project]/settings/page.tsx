import { redirect } from 'next/navigation';
import { Alert } from '@/components/alert';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { getProjectAccess } from '@/lib/dal';
import { updateProjectAction } from '../../../projects/actions';
import { ProjectForm } from '../../../projects/project-form';

export const metadata = { title: 'Ajustes del proyecto' };

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ ok?: string; warn?: string }>;
}) {
  const { project: slug } = await params;
  const access = await getProjectAccess(slug);
  if (!access) redirect('/');
  // Solo los super administradores cambian la configuración de un proyecto
  if (!access.viewer.superAdmin) redirect(`/p/${slug}?denied=1`);

  const { project } = access;
  const { ok, warn } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ajustes del proyecto"
        description="Plantilla, team, prefijo y objetivo con los que se crean y se miden las OVAs de este proyecto."
      />

      {ok && <Alert variant="success" title={ok} />}
      {warn && (
        <Alert variant="warning" title="Revisa la plantilla">
          {warn}
        </Alert>
      )}

      <Card className="max-w-3xl">
        <CardContent>
          <ProjectForm
            action={updateProjectAction}
            projectId={project.id}
            cancelHref={`/p/${project.slug}`}
            submitLabel="Guardar cambios"
            initial={{
              name: project.name,
              org: project.org,
              slug: project.slug,
              template: project.template,
              defaultTeam: project.defaultTeam,
              descriptionPrefix: project.descriptionPrefix,
              total: String(project.total),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
