import Link from 'next/link';
import { Inbox, Search } from 'lucide-react';
import { can } from '@/core';
import { Alert } from '@/components/alert';
import { EmptyState } from '@/components/empty-state';
import { InitialsAvatar } from '@/components/initials-avatar';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { RepoHealth } from '@/components/repo-health';
import { StatusMover } from '@/components/status-mover';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { withBasePath } from '@/lib/base-path';
import { requireProjectPermission } from '@/lib/dal';
import { currentTime, relativeDate } from '@/lib/format';
import { loadHealth } from '@/lib/health';
import { filterOvas, parseOvaQuery } from '@/lib/ova-filter';
import { OVA_STATUSES, STATUS_COLUMN_LABELS, STATUS_HINTS } from '@/lib/ova-status';

export const metadata = { title: 'Tablero' };

/** Máximo de tarjetas por columna: la de entregadas puede llegar a cientos. */
const COLUMN_LIMIT = 30;

export default async function BoardPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{
    schoolId?: string;
    developerId?: string;
    q?: string;
    ok?: string;
    error?: string;
  }>;
}) {
  const { project: slug } = await routeParams;
  const access = await requireProjectPermission(slug, 'ova:view');
  const { project, role, services } = access;
  const base = `/p/${project.slug}`;

  const params = await searchParams;
  const query = parseOvaQuery(params);
  const canEdit = can(role, 'ova:edit');

  const now = currentTime();
  const [all, schools, developers, health] = await Promise.all([
    services.store.list({}),
    services.store.listSchools(),
    services.store.listDevelopers(),
    loadHealth(services, now),
  ]);

  const visible = filterOvas(all, query);
  const hasFilter = query.schoolId !== undefined || query.developerId !== undefined || query.q !== '';

  // La vuelta tras mover una tarjeta conserva los filtros
  const search = new URLSearchParams();
  if (query.schoolId) search.set('schoolId', String(query.schoolId));
  if (query.developerId) search.set('developerId', String(query.developerId));
  if (query.q) search.set('q', query.q);
  const returnTo = `${base}/board${search.toString() ? `?${search}` : ''}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tablero"
        description="Cómo va cada OVA: en desarrollo, en revisión o entregada. Mueve las tarjetas con las flechas."
      />

      {params.ok && <Alert variant="success" title={params.ok} />}
      {params.error && (
        <Alert variant="error" title="No se pudo cambiar el estado">
          {params.error}
        </Alert>
      )}
      {!health.ok && (
        <Alert variant="warning" title="Sin datos de actividad de GitHub">
          {health.error} El tablero funciona igual, pero no se marcan las OVAs estancadas.
        </Alert>
      )}
      {health.ok && (
        <p className="text-sm text-muted-foreground">
          Una OVA en curso se marca como estancada si lleva {health.report.staleAfterDays} días o más sin
          actividad en GitHub.
        </p>
      )}

      <form
        method="get"
        action={withBasePath(`${base}/board`)}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_auto]"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="q">Buscar</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="q"
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="Repositorio, escuela o persona"
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="schoolId">Escuela</Label>
          <NativeSelect id="schoolId" name="schoolId" defaultValue={query.schoolId ?? ''}>
            <option value="">Todas</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="developerId">Desarrollador</Label>
          <NativeSelect id="developerId" name="developerId" defaultValue={query.developerId ?? ''}>
            <option value="">Todos</option>
            {developers.map((developer) => (
              <option key={developer.id} value={developer.id}>
                {developer.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {hasFilter && (
            <Link href={`${base}/board`} className={buttonVariants({ variant: 'ghost' })}>
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {all.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Todavía no hay OVAs registradas"
          description="Cuando se cree la primera aparecerá aquí, en la columna En desarrollo."
        />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {OVA_STATUSES.map((status) => {
            const inColumn = visible
              .filter((ova) => ova.status === status)
              // Primero las estancadas: son las que piden atención
              .sort(
                (a, b) =>
                  Number(health.ok && health.byOvaId.get(b.id)?.stalled === true) -
                  Number(health.ok && health.byOvaId.get(a.id)?.stalled === true),
              );
            const shown = inColumn.slice(0, COLUMN_LIMIT);

            return (
              <Card key={status} aria-labelledby={`col-${status}`}>
                <CardHeader>
                  <CardTitle id={`col-${status}`} className="flex items-center justify-between gap-2">
                    {STATUS_COLUMN_LABELS[status]}
                    <Badge variant="outline" aria-label={`${inColumn.length} OVAs`}>
                      {inColumn.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{STATUS_HINTS[status]}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {shown.length === 0 && (
                    <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                      {hasFilter ? 'Ninguna coincide con los filtros.' : 'Sin OVAs en este estado.'}
                    </p>
                  )}
                  {shown.map((ova) => {
                    const item = health.ok ? health.byOvaId.get(ova.id) : undefined;
                    return (
                      <article
                        key={ova.id}
                        className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-sm shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={ova.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 font-medium break-words text-link underline-offset-4 hover:underline"
                          >
                            {ova.repoName}
                            <span className="sr-only"> (abre GitHub en una pestaña nueva)</span>
                          </a>
                          {canEdit && (
                            <StatusMover
                              project={project.slug}
                              ovaId={ova.id}
                              repoName={ova.repoName}
                              status={ova.status}
                              returnTo={returnTo}
                            />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <Badge variant="secondary">{ova.school.name}</Badge>
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <InitialsAvatar name={ova.developer.name} className="size-5 text-[0.6rem]" />
                            {ova.developer.name}
                          </span>
                        </div>
                        {item && <RepoHealth item={item} />}
                        <p className="text-xs text-muted-foreground">
                          {status === 'delivered' ? 'Entregada' : 'En este estado'}{' '}
                          {relativeDate(ova.statusChangedAt, now)}
                        </p>
                      </article>
                    );
                  })}
                  {inColumn.length > shown.length && (
                    <Link
                      href={`${base}?status=${status}#ovas`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Ver las {inColumn.length - shown.length} restantes en el panel
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {visible.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {visible.length} {visible.length === 1 ? 'OVA' : 'OVAs'}
          {hasFilter ? ` de ${all.length}` : ''}
        </p>
      )}
    </div>
  );
}
