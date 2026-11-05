import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { can } from '@/core';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireProjectPermission } from '@/lib/dal';
import { NewOvaForm } from './new-ova-form';

export default async function NewOvaPage({ params }: { params: Promise<{ project: string }> }) {
  const { project: slug } = await params;
  const { project, role, services } = await requireProjectPermission(slug, 'ova:create');
  const { store } = services;
  const base = `/p/${project.slug}`;
  const [schools, developers] = await Promise.all([store.listSchools(), store.listDevelopers()]);

  const missing =
    schools.length === 0 && developers.length === 0
      ? 'escuelas ni desarrolladores'
      : schools.length === 0
        ? 'escuelas'
        : developers.length === 0
          ? 'desarrolladores'
          : null;
  const isAdmin = can(role, 'catalog:manage');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Crear OVA"
        description="Crea el repositorio en GitHub a partir de la plantilla y déjalo registrado con su escuela y su desarrollador."
      />

      {missing ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title={`Todavía no hay ${missing} en el catálogo`}
            description={
              isAdmin
                ? 'Para crear una OVA hace falta al menos una escuela y un desarrollador. Añádelos en Administración.'
                : 'Para crear una OVA hace falta al menos una escuela y un desarrollador. Pídele a un administrador que los registre.'
            }
            action={
              isAdmin && (
                <Link href={`${base}/admin`} className={buttonVariants()}>
                  Ir a Administración
                </Link>
              )
            }
          />
        </Card>
      ) : (
        <NewOvaForm
          schools={schools.map((s) => ({ id: s.id, name: s.name, slug: s.slug }))}
          developers={developers.map((d) => ({ id: d.id, name: d.name }))}
          config={{
            project: project.slug,
            org: project.org,
            template: project.template,
            team: project.defaultTeam,
            prefix: project.descriptionPrefix,
          }}
        />
      )}
    </div>
  );
}
