import { ListSkeleton, LoadingPage, PageHeaderSkeleton, StatTilesSkeleton } from '@/components/page-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Descripción de una tarjeta que menciona la organización o el team (no se sabe hasta cargar). */
function DescriptionSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 pt-1">
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-4 w-2/3 max-w-md" />
    </div>
  );
}

/** Esta página compara GitHub entero con el registro: es la que más tarda, así que lo avisa. */
export default function ReconcileLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton title="Reparar" />

      <p className="text-sm text-muted-foreground">Comparando GitHub con el registro. Puede tardar unos segundos…</p>

      <StatTilesSkeleton
        labels={['Repositorios revisados', 'OVAs por corregir', 'Sin registrar']}
        className="sm:grid-cols-3"
      />

      <Card>
        <CardHeader>
          <CardTitle>OVAs por corregir</CardTitle>
          <DescriptionSkeleton />
        </CardHeader>
        <CardContent>
          <ListSkeleton rows={3} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repositorios sin registrar</CardTitle>
          <DescriptionSkeleton />
        </CardHeader>
        <CardContent>
          <ListSkeleton rows={4} />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
