import type { ReactNode } from 'react';
import { can } from '@/core';
import { MainNav, type NavItem } from '@/components/main-nav';
import { Badge } from '@/components/ui/badge';
import { requireProjectPermission } from '@/lib/dal';

const ROLE_LABELS = { viewer: 'Lector', creator: 'Creador', admin: 'Admin' } as const;

/** Marco de un proyecto: comprueba el acceso y muestra su navegación y el rol de la persona en él. */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ project: string }>;
}) {
  const { project: slug } = await params;
  const { project, role, viewer } = await requireProjectPermission(slug, 'ova:view');
  const base = `/p/${project.slug}`;

  const items: NavItem[] = [{ href: base, label: 'Panel', icon: 'panel', exact: true }];
  if (can(role, 'ova:create')) items.push({ href: `${base}/ovas/new`, label: 'Crear OVA', icon: 'crear' });
  items.push({ href: `${base}/activity`, label: 'Actividad', icon: 'actividad' });
  if (can(role, 'users:manage')) items.push({ href: `${base}/admin`, label: 'Administración', icon: 'admin' });
  if (viewer.superAdmin) items.push({ href: `${base}/settings`, label: 'Proyecto', icon: 'proyecto' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-3">
        <div className="mr-2 flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{project.name}</span>
          <Badge variant="secondary" title={`Rol en ${project.name}`}>
            {ROLE_LABELS[role]}
          </Badge>
        </div>
        <MainNav items={items} />
      </div>
      {children}
    </div>
  );
}
