import { LoadingPage, PageHeaderSkeleton } from '@/components/page-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Un selector con su etiqueta y la ayuda que lo acompaña (el texto de ayuda es fijo). */
function SelectSkeleton({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm leading-none font-medium">{label}</span>
      <Skeleton className="h-9 w-full" />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** El título lleva el nombre del repositorio y el enlace de vuelta lleva el proyecto: ambos en gris. */
export default function EditOvaLoading() {
  return (
    <LoadingPage>
      <Skeleton className="h-5 w-32" />

      <PageHeaderSkeleton
        description="Corrige la escuela o el desarrollador de esta OVA. El nombre del repositorio no cambia."
        actions={<Skeleton className="h-9 w-44" />}
      />

      <Card className="max-w-2xl">
        <CardContent className="flex flex-col gap-5">
          <SelectSkeleton
            label="Escuela"
            hint="Al cambiarla se actualiza también el topic del repositorio en GitHub (los demás topics se conservan)."
          />
          <SelectSkeleton label="Desarrollador" hint="Solo cambia en el registro del panel, no en GitHub." />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>
    </LoadingPage>
  );
}
