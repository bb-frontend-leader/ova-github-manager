import { FilterBarSkeleton, LoadingPage, PageHeaderSkeleton } from '@/components/page-skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OVA_STATUSES, STATUS_COLUMN_LABELS, STATUS_HINTS } from '@/lib/ova-status';

/** Tarjeta de una OVA del tablero: nombre, escuela y persona, estado de GitHub y fecha. */
function OvaCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs">
      <Skeleton className="h-4 w-40 max-w-full" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export default function BoardLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton
        title="Tablero"
        description="Cómo va cada OVA: en desarrollo, en revisión o entregada. Mueve las tarjetas con las flechas."
      />

      <Skeleton className="h-4 w-full max-w-xl" />

      <FilterBarSkeleton
        labels={['Buscar', 'Escuela', 'Desarrollador']}
        className="sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto]"
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {OVA_STATUSES.map((status) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                {STATUS_COLUMN_LABELS[status]}
                <Skeleton className="h-5 w-8 rounded-full" />
              </CardTitle>
              <CardDescription>{STATUS_HINTS[status]}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <OvaCardSkeleton />
              <OvaCardSkeleton />
              <OvaCardSkeleton />
            </CardContent>
          </Card>
        ))}
      </div>
    </LoadingPage>
  );
}
