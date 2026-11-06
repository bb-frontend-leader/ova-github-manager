import Link from 'next/link';
import { Hammer, CircleCheck, Eye, Pencil, TriangleAlert, UserRound } from 'lucide-react';
import { can } from '@/core';
import { Alert } from '@/components/alert';
import { StatTile } from '@/components/dataviz/stat-tile';
import { EmptyState } from '@/components/empty-state';
import { InitialsAvatar } from '@/components/initials-avatar';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { RepoHealth } from '@/components/repo-health';
import { StatusMover } from '@/components/status-mover';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { withBasePath } from '@/lib/base-path';
import { requireProjectPermission } from '@/lib/dal';
import { currentTime, relativeDate } from '@/lib/format';
import { loadHealth } from '@/lib/health';
import { parseId } from '@/lib/ova-filter';
import { OVA_STATUSES, STATUS_COLUMN_LABELS, STATUS_HINTS } from '@/lib/ova-status';

export const metadata = { title: 'Mi trabajo' };

export default async function MyWorkPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ developerId?: string; ok?: string; error?: string }>;
}) {
  const { project: slug } = await routeParams;
  const access = await requireProjectPermission(slug, 'ova:view');
  const { project, role, login, services } = access;
  const base = `/p/${project.slug}`;

  const params = await searchParams;
  const canEdit = can(role, 'ova:edit');
  const canManage = can(role, 'catalog:manage');

  const developers = await services.store.listDevelopers();
  // Un administrador puede ver el trabajo de otra persona; los demás, solo el suyo
  const requestedId = canManage ? parseId(params.developerId) : undefined;
  const mine = developers.find((d) => d.githubLogin === login) ?? null;
  const developer = (requestedId && developers.find((d) => d.id === requestedId)) || mine;
  const viewingOther = developer !== null && developer.id !== mine?.id;

  const now = currentTime();
  const picker = canManage && developers.length > 0 && (
    <form
      method="get"
      action={withBasePath(`${base}/mine`)}
      className="flex flex-wrap items-end gap-2"
    >
      <div className="flex min-w-56 flex-col gap-1.5">
        <Label htmlFor="developerId">Ver el trabajo de</Label>
        <NativeSelect id="developerId" name="developerId" defaultValue={developer?.id ?? ''}>
          <option value="" disabled>
            Elige una persona
          </option>
          {developers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
              {d.githubLogin ? ` (@${d.githubLogin})` : ''}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit" variant="secondary">
        Ver
      </Button>
    </form>
  );

  if (!developer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Mi trabajo" description="Tus OVAs, su estado y lo que necesita atención." />
        {picker}
        <EmptyState
          icon={UserRound}
          title="Tu usuario aún no está vinculado a un desarrollador"
          description={
            canManage
              ? `Vincula @${login} con tu nombre en Administración (o elige a otra persona arriba) para ver sus OVAs aquí.`
              : `Pídele a un administrador que vincule @${login} con tu nombre en este proyecto; así verás aquí tus OVAs.`
          }
          action={
            canManage && (
              <Link href={`${base}/admin`} className={buttonVariants()}>
                Ir a Administración
              </Link>
            )
          }
        />
      </div>
    );
  }

  const [ovas, health, total] = await Promise.all([
    services.store.list({ developerId: developer.id }),
    loadHealth(services, now),
    services.store.stats().then((s) => s.total),
  ]);

  const stalledCount = health.ok ? ovas.filter((o) => health.byOvaId.get(o.id)?.stalled).length : 0;
  const count = (status: (typeof OVA_STATUSES)[number]) => ovas.filter((o) => o.status === status).length;
  const share = total > 0 ? Math.round((ovas.length / total) * 100) : 0;
  const returnTo = `${base}/mine${viewingOther ? `?developerId=${developer.id}` : ''}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={viewingOther ? `Trabajo de ${developer.name}` : 'Mi trabajo'}
        description={
          viewingOther
            ? 'Estás viendo las OVAs de otra persona.'
            : `Tus OVAs en ${project.name}, su estado y lo que necesita atención.`
        }
      />

      {picker}

      {params.ok && <Alert variant="success" title={params.ok} />}
      {params.error && (
        <Alert variant="error" title="No se pudo cambiar el estado">
          {params.error}
        </Alert>
      )}
      {!health.ok && (
        <Alert variant="warning" title="Sin datos de actividad de GitHub">
          {health.error} Se muestran tus OVAs, pero no se marcan las estancadas.
        </Alert>
      )}

      <div className="flex items-center gap-3">
        <InitialsAvatar name={developer.name} />
        <div className="leading-tight">
          <p className="font-medium">{developer.name}</p>
          <p className="text-sm text-muted-foreground">
            {developer.githubLogin ? `@${developer.githubLogin} · ` : ''}
            {ovas.length} {ovas.length === 1 ? 'OVA' : 'OVAs'}
            {total > 0 ? ` · ${share}% del total del proyecto` : ''}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Hammer} label="En desarrollo" value={count('development')} />
        <StatTile icon={Eye} label="En revisión" value={count('review')} />
        <StatTile icon={CircleCheck} label="Entregadas" value={count('delivered')} />
        <StatTile
          icon={TriangleAlert}
          label="Estancadas"
          value={health.ok ? stalledCount : '—'}
          hint={
            health.ok
              ? stalledCount === 0
                ? 'Todo al día'
                : `Sin actividad en ${health.report.staleAfterDays} días o más`
              : 'Sin datos de GitHub'
          }
        />
      </div>

      {ovas.length === 0 ? (
        <EmptyState
          icon={Hammer}
          title="Todavía no tiene OVAs asignadas"
          description="Cuando se le asigne una OVA aparecerá aquí con su estado."
        />
      ) : (
        OVA_STATUSES.map((status) => {
          const inStatus = ovas
            .filter((o) => o.status === status)
            .sort(
              (a, b) =>
                Number(health.ok && health.byOvaId.get(b.id)?.stalled === true) -
                Number(health.ok && health.byOvaId.get(a.id)?.stalled === true),
            );
          if (inStatus.length === 0) return null;
          return (
            <Card key={status}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {STATUS_COLUMN_LABELS[status]}
                  <Badge variant="outline">{inStatus.length}</Badge>
                </CardTitle>
                <CardDescription>{STATUS_HINTS[status]}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
                  {inStatus.map((ova) => {
                    const item = health.ok ? health.byOvaId.get(ova.id) : undefined;
                    return (
                      <li key={ova.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={ova.repoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium break-words text-link underline-offset-4 hover:underline"
                            >
                              {ova.repoName}
                              <span className="sr-only"> (abre GitHub en una pestaña nueva)</span>
                            </a>
                            <Badge variant="secondary">{ova.school.name}</Badge>
                          </div>
                          {item && <RepoHealth item={item} />}
                          <p className="text-xs text-muted-foreground">
                            {status === 'delivered' ? 'Entregada' : 'En este estado'}{' '}
                            {relativeDate(ova.statusChangedAt, now)}
                          </p>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-2">
                            <StatusMover
                              project={project.slug}
                              ovaId={ova.id}
                              repoName={ova.repoName}
                              status={ova.status}
                              returnTo={returnTo}
                            />
                            <Link
                              href={`${base}/ovas/${ova.id}/edit`}
                              aria-label={`Editar ${ova.repoName}`}
                              title="Editar escuela o desarrollador"
                              className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}
                            >
                              <Pencil aria-hidden />
                            </Link>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
