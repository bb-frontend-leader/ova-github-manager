import Link from 'next/link';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { InitialsAvatar } from '@/components/initials-avatar';
import { RepoHealth } from '@/components/repo-health';
import { StatusBadge } from '@/components/status-badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { currentTime } from '@/lib/format';
import { loadHealth } from '@/lib/health';
import type { ProjectServices } from '@/lib/services';

/** Cuántas OVAs estancadas se listan; el resto se ve en el tablero. */
const LIMIT = 6;

const TITLE = 'Requieren atención';

/** Marcador mientras se consulta a GitHub: el resto del panel no espera por esto. */
export function AttentionFallback() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <CardTitle>{TITLE}</CardTitle>
        <CardDescription>Consultando la actividad en GitHub…</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2" aria-hidden>
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

/** OVAs en curso sin actividad reciente en GitHub (las más antiguas primero). */
export async function AttentionCard({ services, base }: { services: ProjectServices; base: string }) {
  const health = await loadHealth(services, currentTime());

  if (!health.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{TITLE}</CardTitle>
          <CardDescription>{health.error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const stalled = health.report.items
    .filter((item) => item.stalled)
    .sort((a, b) => b.idleDays - a.idleDays);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {stalled.length === 0 ? (
            <CircleCheck className="size-4 text-success" aria-hidden />
          ) : (
            <TriangleAlert className="size-4 text-warning" aria-hidden />
          )}
          {TITLE}
        </CardTitle>
        <CardDescription>
          {stalled.length === 0
            ? `Ninguna OVA en curso lleva ${health.report.staleAfterDays} días o más sin actividad.`
            : `OVAs en curso sin actividad en GitHub desde hace ${health.report.staleAfterDays} días o más.`}
        </CardDescription>
      </CardHeader>
      {stalled.length > 0 && (
        <CardContent className="flex flex-col gap-3">
          <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
            {stalled.slice(0, LIMIT).map((item) => (
              <li key={item.ova.id} className="flex flex-col gap-1.5 px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    href={item.ova.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium break-words text-link underline-offset-4 hover:underline"
                  >
                    {item.ova.repoName}
                    <span className="sr-only"> (abre GitHub en una pestaña nueva)</span>
                  </a>
                  <StatusBadge status={item.ova.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <InitialsAvatar name={item.ova.developer.name} className="size-5 text-[0.6rem]" />
                    {item.ova.developer.name}
                  </span>
                  <RepoHealth item={item} />
                </div>
              </li>
            ))}
          </ul>
          {stalled.length > LIMIT && (
            <p className="text-sm text-muted-foreground">
              Y {stalled.length - LIMIT} más. Míralas en el tablero.
            </p>
          )}
          <Link href={`${base}/board`} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit' })}>
            Abrir el tablero
          </Link>
        </CardContent>
      )}
    </Card>
  );
}
