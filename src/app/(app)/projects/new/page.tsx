import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { requireSuperAdmin } from '@/lib/dal';
import { createProjectAction } from '../actions';
import { ProjectForm } from '../project-form';

export const metadata = { title: 'Nuevo proyecto' };

export default async function NewProjectPage() {
  await requireSuperAdmin();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Volver a los proyectos
      </Link>

      <PageHeader
        title="Nuevo proyecto"
        description="Registra otra organización de GitHub para gestionar sus OVAs. Quedará con su propio catálogo, sus usuarios y su actividad."
      />

      <Card className="max-w-3xl">
        <CardContent>
          <ProjectForm action={createProjectAction} cancelHref="/" submitLabel="Crear proyecto" />
        </CardContent>
      </Card>
    </div>
  );
}
