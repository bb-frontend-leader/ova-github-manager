import {
  BarsSkeleton,
  FilterBarSkeleton,
  LoadingPage,
  PageHeaderSkeleton,
  StatTilesSkeleton,
  TableSkeleton,
} from '@/components/page-skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Esqueleto del Panel. Cada subpágina (tablero, carga, actividad…) tiene el suyo; este solo
 * aparece al entrar al Panel.
 */
export default function DashboardLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton title="Panel" />

      <Card>
        <CardContent className="flex flex-col gap-5 pt-1">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className="text-sm text-muted-foreground">OVAs creadas</p>
              <Skeleton className="mt-2 h-12 w-44 sm:h-14" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <Skeleton className="h-8 w-16" />
              <span className="text-sm text-muted-foreground">del objetivo</span>
            </div>
          </div>
          <Skeleton className="h-3 w-full rounded-full" />
        </CardContent>
      </Card>

      <StatTilesSkeleton labels={['Por crear', 'Últimos 7 días', 'Última OVA']} className="sm:grid-cols-3" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por escuela</CardTitle>
            <CardDescription>Selecciona una escuela para ver sus OVAs.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarsSkeleton rows={5} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Por desarrollador</CardTitle>
            <CardDescription>Selecciona una persona para ver su trabajo.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarsSkeleton rows={5} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por estado</CardTitle>
            <CardDescription>Selecciona un estado para ver sus OVAs.</CardDescription>
          </CardHeader>
          <CardContent>
            <BarsSkeleton rows={3} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Requieren atención</CardTitle>
            <CardDescription>Consultando la actividad en GitHub…</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            OVAs <Skeleton className="h-4 w-10" />
          </CardTitle>
          <Skeleton className="mt-1 h-4 w-64 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FilterBarSkeleton
            labels={['Buscar', 'Escuela', 'Desarrollador', 'Estado']}
            className="sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_auto]"
          />
          <TableSkeleton
            rows={8}
            columns={[
              { label: 'Repositorio', width: 'w-40' },
              { label: 'Escuela', width: 'w-24' },
              { label: 'Desarrollador', width: 'w-28' },
              { label: 'Estado', width: 'w-20' },
              { label: 'Creada por', width: 'w-20' },
              { label: 'Creada', width: 'w-16', align: 'right' },
            ]}
          />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
