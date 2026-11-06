import Link from 'next/link';
import type { ReactNode } from 'react';

export interface RankedItem {
  id: number | string;
  label: string;
  count: number;
  /** Si se indica, la etiqueta es un enlace (p. ej. para filtrar el listado) */
  href?: string;
  /** Texto accesible del enlace, p. ej. "Ver las 12 OVAs de Ingeniería" */
  hrefLabel?: string;
  /** Contenido a la izquierda de la etiqueta (p. ej. avatar) */
  leading?: ReactNode;
}

const VISIBLE = 8;

function Row({ item, max }: { item: RankedItem; max: number }) {
  // Barra: una sola base, extremo de datos redondeado (4px) y base cuadrada, nunca más de 12px.
  // El valor va en la punta. Una OVA siempre se ve (mínimo 4px) aunque la proporción sea mínima.
  const ratio = max > 0 ? item.count / max : 0;
  const label = (
    <span className="flex min-w-0 items-center gap-2">
      {item.leading}
      <span className="truncate">{item.label}</span>
    </span>
  );

  return (
    <li
      className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]"
      title={`${item.label}: ${item.count}`}
    >
      {item.href ? (
        <Link
          href={item.href}
          aria-label={item.hrefLabel}
          className="min-w-0 rounded-sm text-sm hover:text-link hover:underline underline-offset-4"
        >
          {label}
        </Link>
      ) : (
        <div className="min-w-0 text-sm">{label}</div>
      )}
      <div className="flex items-center gap-2" aria-hidden={false}>
        {item.count > 0 && (
          <span
            className="h-3 min-w-1 rounded-r-[4px] bg-data transition-[width] duration-500 ease-out"
            style={{ width: `calc((100% - 2.5rem) * ${ratio})` }}
          />
        )}
        <span className="text-sm font-medium tabular-nums">{item.count}</span>
      </div>
    </li>
  );
}

/**
 * Barras horizontales ordenadas de mayor a menor, un solo tono (azul secuencial).
 * Con muchas filas muestra las primeras y el resto queda tras un desplegable.
 */
export function RankedBars({
  items,
  label,
  empty,
}: {
  items: RankedItem[];
  /** Nombre accesible de la lista */
  label: string;
  /** Texto cuando no hay elementos */
  empty: ReactNode;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  const sorted = [...items].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
  const max = sorted[0].count;
  const head = sorted.slice(0, VISIBLE);
  const tail = sorted.slice(VISIBLE);

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label={label} className="flex flex-col gap-3">
        {head.map((item) => (
          <Row key={item.id} item={item} max={max} />
        ))}
      </ul>
      {tail.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer rounded-sm text-sm text-link underline-offset-4 hover:underline">
            <span className="group-open:hidden">Mostrar {tail.length} más</span>
            <span className="hidden group-open:inline">Mostrar menos</span>
          </summary>
          <ul aria-label={`${label} (resto)`} className="mt-3 flex flex-col gap-3">
            {tail.map((item) => (
              <Row key={item.id} item={item} max={max} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
