import { LoadingPage, PageHeaderSkeleton } from '@/components/page-skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Esqueleto de la lista de proyectos. Vive en el grupo (home) para no cubrir también p/ y projects/,
 * que tienen los suyos. Los botones de la cabecera y la copia de seguridad solo los ven los super
 * administradores, así que no se dibujan.
 */
export default function ProjectsLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton
        title="Proyectos"
        description="Cada proyecto es una organización de GitHub con sus propias OVAs, escuelas, desarrolladores y usuarios."
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index}>
            <Card className="h-full">
              <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-1 h-4 w-48" />
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-3 w-full rounded-full" />
                </div>
                <Skeleton className="h-9 w-24" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </LoadingPage>
  );
}
