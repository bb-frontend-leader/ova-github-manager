import { FieldSkeleton, LoadingPage, PageHeaderSkeleton } from '@/components/page-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function ImportProjectLoading() {
  return (
    <LoadingPage>
      <Skeleton className="h-5 w-44" />

      <PageHeaderSkeleton
        title="Importar proyecto"
        description="Crea un proyecto nuevo con los ajustes, el catálogo, las OVAs, los usuarios y la actividad de un archivo exportado."
      />

      <Skeleton className="h-36 w-full rounded-xl" />

      <Card className="max-w-3xl">
        <CardContent className="flex flex-col gap-5">
          <FieldSkeleton label="Archivo del proyecto" hint />
          <FieldSkeleton label="Identificador nuevo (opcional)" hint />
          <div className="flex gap-3">
            <Skeleton className="h-9 w-44" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
