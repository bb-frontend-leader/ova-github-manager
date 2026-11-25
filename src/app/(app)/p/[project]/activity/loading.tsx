import { FilterBarSkeleton, LoadingPage, PageHeaderSkeleton, TableSkeleton } from '@/components/page-skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function ActivityLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton
        title="Actividad"
        description="Quién creó, editó o quitó cada OVA, y cuándo. Lo más reciente aparece primero."
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <FilterBarSkeleton labels={['Buscar', 'Acción']} className="sm:grid-cols-[minmax(0,1.4fr)_1fr_auto]" />
          <TableSkeleton
            rows={10}
            columns={[
              { label: 'Cuándo', width: 'w-20' },
              { label: 'Quién', width: 'w-28' },
              { label: 'Acción', width: 'w-20' },
              { label: 'OVA', width: 'w-36' },
              { label: 'Detalle', width: 'w-48' },
            ]}
          />
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
