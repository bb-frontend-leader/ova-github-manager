import { cn } from '@/lib/utils';

/** Marca de la herramienta: un repositorio (ramas) dentro de un cuadrado redondeado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="5.5" r="2" />
        <circle cx="6" cy="18.5" r="2" />
        <circle cx="18" cy="9" r="2" />
        <path d="M6 7.5v9" />
        <path d="M18 11c0 4-6 3-12 5.5" />
      </svg>
    </span>
  );
}
