import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const VARIANTS = {
  success: { icon: CircleCheck, box: 'border-success/40 bg-success/10', tone: 'text-success' },
  error: { icon: CircleAlert, box: 'border-destructive/40 bg-destructive/10', tone: 'text-destructive' },
  warning: { icon: TriangleAlert, box: 'border-warning/40 bg-warning/10', tone: 'text-warning' },
  info: { icon: Info, box: 'border-link/30 bg-accent', tone: 'text-link' },
} as const;

/**
 * Mensaje de estado. El significado nunca depende solo del color: lleva icono y título.
 * Los errores se anuncian de inmediato (role="alert"); el resto, de forma cortés (role="status").
 */
export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: keyof typeof VARIANTS;
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, box, tone } = VARIANTS[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', box, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', tone)}>{title}</p>
        {children && <div className="mt-1 text-foreground/90">{children}</div>}
      </div>
    </div>
  );
}
