import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/*
 * Piezas para los loading.tsx de cada página. Regla: lo que es texto fijo de la página (títulos,
 * etiquetas, encabezados de tabla) se pinta de verdad; solo lo que depende de datos es un bloque
 * gris. Así el esqueleto ocupa el mismo sitio que la página real y no hay saltos al cargar.
 */

/** Marco de un loading.tsx: se anuncia a lectores de pantalla y mantiene el espaciado de la página. */
export function LoadingPage({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}

/** Igual que PageHeader; lo que se omite (porque depende de datos) se sustituye por un bloque gris. */
export function PageHeaderSkeleton({
  title,
  description,
  actions,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {title ? (
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        ) : (
          <Skeleton className="h-8 w-48" />
        )}
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : (
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Un campo de formulario: su etiqueta real y el control (y la ayuda, si la hay) en gris. */
export function FieldSkeleton({
  label,
  hint = false,
  className,
}: {
  label: string;
  hint?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm leading-none font-medium">{label}</span>
      <Skeleton className="h-9 w-full" />
      {hint && <Skeleton className="my-0.5 h-3 w-3/4" />}
    </div>
  );
}

/** Fila de filtros de un listado: etiquetas reales, controles y botón en gris. `className` pone las columnas. */
export function FilterBarSkeleton({ labels, className }: { labels: string[]; className: string }) {
  return (
    <div className={cn('grid gap-3', className)}>
      {labels.map((label) => (
        <FieldSkeleton key={label} label={label} />
      ))}
      <div className="flex items-end">
        <Skeleton className="h-9 w-20" />
      </div>
    </div>
  );
}

/** Mosaicos de métricas (StatTile): la etiqueta es real; el valor y el contexto, en gris. */
export function StatTilesSkeleton({ labels, className }: { labels: string[]; className: string }) {
  return (
    <div className={cn('grid gap-3', className)}>
      {labels.map((label) => (
        <Card key={label} size="sm" className="shadow-xs">
          <div className="flex flex-col gap-1 px-(--card-spacing)">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Skeleton className="my-1 h-6 w-16" />
            <Skeleton className="my-0.5 h-3 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export interface SkeletonColumn {
  label: string;
  /** Ancho del bloque gris de esa columna (clases de Tailwind) */
  width: string;
  align?: 'right';
}

/** Tabla con sus encabezados reales y filas en gris. */
export function TableSkeleton({ columns, rows = 6 }: { columns: SkeletonColumn[]; rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.label} className={column.align === 'right' ? 'text-right' : undefined}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, row) => (
            <TableRow key={row}>
              {columns.map((column) => (
                <TableCell key={column.label}>
                  <Skeleton className={cn('h-4', column.width, column.align === 'right' && 'ml-auto')} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Lista con filas separadas (como las de «Mi trabajo», Reparar o Administración). */
export function ListSkeleton({ rows = 3, avatar = false }: { rows?: number; avatar?: boolean }) {
  return (
    <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
      {Array.from({ length: rows }, (_, row) => (
        <li key={row} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {avatar && <Skeleton className="size-7 shrink-0 rounded-full" />}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-48 max-w-full" />
              <Skeleton className="h-3 w-32 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

/** Filas de barras con su etiqueta y su cuenta (RankedBars). */
export function BarsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-3">
          <Skeleton className="h-4 w-28 shrink-0" />
          <Skeleton className="h-3 flex-1 rounded-full" />
          <Skeleton className="h-4 w-6 shrink-0" />
        </div>
      ))}
    </div>
  );
}
