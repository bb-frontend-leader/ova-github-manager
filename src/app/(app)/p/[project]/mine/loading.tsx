import { ListSkeleton, LoadingPage, PageHeaderSkeleton, StatTilesSkeleton } from '@/components/page-skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { STATUS_COLUMN_LABELS, STATUS_HINTS } from '@/lib/ova-status';

/**
 * El título se queda en gris porque cambia según de quién sea el trabajo («Mi trabajo» o
 * «Trabajo de …»), y eso no se sabe hasta cargar.
 */
export default function MyWorkLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton />

      <div className="flex items-center gap-3">
        <Skeleton className="size-7 shrink-0 rounded-full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3.5 w-56 max-w-full" />
        </div>
      </div>

      <StatTilesSkeleton
        labels={['En desarrollo', 'En revisión', 'Entregadas', 'Estancadas']}
        className="sm:grid-cols-2 lg:grid-cols-4"
      />

      {(['development', 'review'] as const).map((status, index) => (
        <Card key={status}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {STATUS_COLUMN_LABELS[status]}
              <Skeleton className="h-5 w-8 rounded-full" />
            </CardTitle>
            <CardDescription>{STATUS_HINTS[status]}</CardDescription>
          </CardHeader>
          <CardContent>
            <ListSkeleton rows={index === 0 ? 3 : 2} />
          </CardContent>
        </Card>
      ))}
    </LoadingPage>
  );
}
