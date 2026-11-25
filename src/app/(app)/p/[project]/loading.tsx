import { Skeleton } from '@/components/ui/skeleton';

/**
 * Estado de carga de cualquier página del proyecto. Next lo muestra al instante al navegar,
 * mientras la página espera sus datos; la navegación del proyecto (layout) sigue visible.
 */
export default function ProjectPageLoading() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Cargando…</span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto]">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((column) => (
          <div key={column} className="flex flex-col gap-3 rounded-xl border p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-24" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
