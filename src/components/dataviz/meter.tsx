import { cn } from '@/lib/utils';

/**
 * Medidor: una razón contra un límite. El relleno lleva el dato; la pista es un tono más claro
 * de la misma rampa azul (en vez de gris) para que el estado se lea a lo largo de toda la barra.
 */
export function Meter({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  /** Nombre accesible, p. ej. "OVAs creadas" */
  label: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={`${value} de ${max}`}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-data-track', className)}
    >
      <div
        className="h-full rounded-full bg-data transition-[width] duration-500 ease-out"
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
