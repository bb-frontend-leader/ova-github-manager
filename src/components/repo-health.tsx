import { CircleCheck, CircleX, GitPullRequest, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { OvaHealth, RepositoryHealth } from '@/core';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const CI: Record<
  Exclude<RepositoryHealth['ci'], 'none'>,
  { icon: typeof CircleCheck; label: string; tone: string }
> = {
  success: { icon: CircleCheck, label: 'CI correcto', tone: 'text-success' },
  failure: { icon: CircleX, label: 'CI fallando', tone: 'text-destructive' },
  pending: { icon: LoaderCircle, label: 'CI en curso', tone: 'text-warning' },
};

export function idleLabel(days: number): string {
  if (days === 0) return 'Actividad hoy';
  return `Sin actividad hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

/**
 * Resumen de cómo va el repositorio: actividad, PRs abiertos y resultado del CI.
 * Cada dato lleva texto además de icono y color.
 */
export function RepoHealth({
  item,
  className,
}: {
  item: OvaHealth;
  className?: string;
}) {
  const { health, idleDays, stalled } = item;
  // En una OVA entregada la inactividad es lo esperado: no se muestra
  const delivered = item.ova.status === 'delivered';
  const ci = health && health.ci !== 'none' ? CI[health.ci] : null;

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground', className)}>
      {stalled ? (
        <Badge variant="destructive">
          <TriangleAlert aria-hidden /> Estancada · {idleDays} {idleDays === 1 ? 'día' : 'días'}
        </Badge>
      ) : (
        !delivered && <span>{idleLabel(idleDays)}</span>
      )}
      {health && health.openPullRequests > 0 && (
        <span className="inline-flex items-center gap-1">
          <GitPullRequest className="size-3.5" aria-hidden />
          {health.openPullRequests} {health.openPullRequests === 1 ? 'PR abierto' : 'PRs abiertos'}
        </span>
      )}
      {ci && (
        <span className={cn('inline-flex items-center gap-1', ci.tone)}>
          <ci.icon className="size-3.5" aria-hidden />
          {ci.label}
        </span>
      )}
      {!health && <span>Sin datos de GitHub</span>}
    </div>
  );
}
