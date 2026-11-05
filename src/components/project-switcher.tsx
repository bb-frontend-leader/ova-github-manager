'use client';

import { useParams, useRouter } from 'next/navigation';
import { NativeSelect } from '@/components/native-select';

export interface SwitcherProject {
  slug: string;
  name: string;
}

const ALL = '__all__';

/** Cambia de proyecto sin pasar por el listado. Mantiene el proyecto actual seleccionado. */
export function ProjectSwitcher({ projects }: { projects: SwitcherProject[] }) {
  const router = useRouter();
  const params = useParams<{ project?: string }>();
  const current = params.project ?? ALL;

  return (
    <NativeSelect
      aria-label="Proyecto"
      value={current}
      className="h-9 w-auto max-w-44 sm:max-w-64"
      onChange={(event) => {
        const value = event.target.value;
        router.push(value === ALL ? '/' : `/p/${value}`);
      }}
    >
      {current === ALL && <option value={ALL}>Todos los proyectos</option>}
      {projects.map((project) => (
        <option key={project.slug} value={project.slug}>
          {project.name}
        </option>
      ))}
    </NativeSelect>
  );
}
