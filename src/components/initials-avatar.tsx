import { cn } from '@/lib/utils';

function initialsOf(name: string): string {
  const parts = name.replace(/^@/, '').trim().split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** Círculo con iniciales. Decorativo: el nombre siempre va escrito al lado. */
export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[0.7rem] font-semibold text-accent-foreground',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
