import { LoadingPage, PageHeaderSkeleton, StatTilesSkeleton } from '@/components/page-skeleton';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Una persona del reparto: nombre, insignias, barra de carga y su desglose. */
function DeveloperLoadSkeleton() {
  return (
    <li>
      <Card size="sm" className="gap-3 px-(--card-spacing) shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-64 max-w-full" />
      </Card>
    </li>
  );
}

export default function WorkloadLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton
        title="Carga de trabajo"
        description="Cuántas OVAs lleva cada persona y quién tiene hueco. La carga cuenta las OVAs en desarrollo y en revisión."
      />

      <StatTilesSkeleton
        labels={['OVAs activas', 'Promedio por persona', 'Con más carga', 'Sin carga']}
        className="sm:grid-cols-2 lg:grid-cols-4"
      />

      <Skeleton className="h-4 w-80 max-w-full" />

      <ul className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, index) => (
          <DeveloperLoadSkeleton key={index} />
        ))}
      </ul>
    </LoadingPage>
  );
}
