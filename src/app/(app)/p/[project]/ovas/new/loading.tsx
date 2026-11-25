import { FieldSkeleton, LoadingPage, PageHeaderSkeleton } from '@/components/page-skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const PREVIEW_ROWS = ['Repositorio', 'Escuela', 'Desarrollador', 'Plantilla', 'Equipo', 'Descripción', 'Visibilidad'];

export default function NewOvaLoading() {
  return (
    <LoadingPage>
      <PageHeaderSkeleton
        title="Crear OVA"
        description="Crea el repositorio en GitHub a partir de la plantilla y déjalo registrado con su escuela y su desarrollador."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <FieldSkeleton label="Nombre de la OVA" hint />
            <div className="grid gap-5 sm:grid-cols-2">
              <FieldSkeleton label="Escuela" hint />
              <FieldSkeleton label="Desarrollador" hint />
            </div>
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vista previa</CardTitle>
            <CardDescription>Esto es lo que se creará en GitHub.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y">
              {PREVIEW_ROWS.map((label) => (
                <div key={label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-2 text-sm">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>
                    <Skeleton className="my-0.5 h-4 w-40 max-w-full" />
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </LoadingPage>
  );
}
