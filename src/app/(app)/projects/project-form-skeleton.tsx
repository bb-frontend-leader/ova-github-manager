import { FieldSkeleton } from '@/components/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto de ProjectForm. Al crear hay un campo más (el identificador); al editar no. */
export function ProjectFormSkeleton({ withSlug }: { withSlug: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FieldSkeleton label="Nombre del proyecto" hint />
        <FieldSkeleton label="Organización de GitHub" hint />
        {withSlug && <FieldSkeleton label="Identificador (opcional)" hint />}
        <FieldSkeleton label="Objetivo de OVAs" hint />
        <FieldSkeleton label="Repositorio plantilla" hint />
        <FieldSkeleton label="Team con acceso de escritura" hint />
        <FieldSkeleton label="Prefijo de la descripción" hint />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-24" />
      </div>
    </div>
  );
}
