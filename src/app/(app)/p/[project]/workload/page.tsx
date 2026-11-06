import Link from 'next/link';
import { ChevronDown, CircleCheck, Eye, Hammer, Scale, TriangleAlert, UserRoundCheck, Users } from 'lucide-react';
import { can, type DeveloperLoad, type LoadLevel, type OvaRecord } from '@/core';
import { Alert } from '@/components/alert';
import { StatTile } from '@/components/dataviz/stat-tile';
import { EmptyState } from '@/components/empty-state';
import { InitialsAvatar } from '@/components/initials-avatar';
import { PageHeader } from '@/components/page-header';
import { CheckAll, ReassignBar } from '@/components/reassign-controls';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { requireProjectPermission } from '@/lib/dal';
import { currentTime } from '@/lib/format';
import { loadHealth } from '@/lib/health';
import { reassignOvasAction } from '../actions';

export const metadata = { title: 'Carga de trabajo' };

const number = new Intl.NumberFormat('es', { maximumFractionDigits: 1 });

const LEVELS: Record<Exclude<LoadLevel, 'normal'>, { label: string; icon: typeof Scale; tone: string }> = {
  high: { label: 'Carga alta', icon: TriangleAlert, tone: 'bg-warning/15 text-warning' },
  low: { label: 'Con hueco', icon: UserRoundCheck, tone: 'bg-success/15 text-success' },
};

const SEGMENTS = [
  { key: 'development', label: 'En desarrollo', icon: Hammer, bar: 'bg-data' },
  { key: 'review', label: 'En revisión', icon: Eye, bar: 'bg-warning' },
  { key: 'delivered', label: 'Entregadas', icon: CircleCheck, bar: 'bg-success/45' },
] as const;

function signed(value: number): string {
  if (value === 0) return 'en el promedio';
  return `${value > 0 ? '+' : '−'}${number.format(Math.abs(value))} vs promedio`;
}

/** Barra apilada: desarrollo, revisión y entregadas. Todas comparten escala, así se comparan entre personas. */
function LoadBar({ load, max }: { load: DeveloperLoad; max: number }) {
  const summary = SEGMENTS.map((s) => `${load[s.key]} ${s.label.toLowerCase()}`).join(', ');
  return (
    <div className="h-3 w-full" role="img" aria-label={summary}>
      <div className="flex h-full gap-0.5" style={{ width: `${max > 0 ? (load.total / max) * 100 : 0}%` }}>
        {SEGMENTS.map(
          (s) =>
            load[s.key] > 0 && (
              <span
                key={s.key}
                title={`${load[s.key]} ${s.label.toLowerCase()}`}
                className={`${s.bar} h-full min-w-1 first:rounded-l-[4px] last:rounded-r-[4px]`}
                style={{ flexGrow: load[s.key] }}
              />
            ),
        )}
      </div>
    </div>
  );
}

export default async function WorkloadPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { project: slug } = await routeParams;
  const access = await requireProjectPermission(slug, 'ova:view');
  const { project, role, services } = access;
  const base = `/p/${project.slug}`;
  const params = await searchParams;
  const canEdit = can(role, 'ova:edit');
  const canManage = can(role, 'catalog:manage');

  const now = currentTime();
  const [ovas, health] = await Promise.all([services.store.list({}), loadHealth(services, now)]);
  const stalledIds = health.ok
    ? new Set(health.report.items.filter((item) => item.stalled).map((item) => item.ova.id))
    : null;
  const report = await services.workload.execute(stalledIds);
  const { developers } = report;

  const maxTotal = Math.max(0, ...developers.map((d) => d.total));
  const busiest = developers[0] && developers[0].active > 0 ? developers[0] : null;

  // Solo las OVAs activas se reasignan; las estancadas y las de más tiempo en su estado, primero
  const activeByDeveloper = new Map<number, OvaRecord[]>();
  for (const ova of ovas) {
    if (ova.status === 'delivered') continue;
    const list = activeByDeveloper.get(ova.developer.id) ?? [];
    list.push(ova);
    activeByDeveloper.set(ova.developer.id, list);
  }
  for (const list of activeByDeveloper.values()) {
    list.sort(
      (a, b) =>
        Number(stalledIds?.has(b.id) ?? false) - Number(stalledIds?.has(a.id) ?? false) ||
        a.statusChangedAt.localeCompare(b.statusChangedAt) ||
        a.id - b.id,
    );
  }

  const content = (
    <ul className="flex flex-col gap-3">
      {developers.map((load) => {
        const level = load.level === 'normal' ? null : LEVELS[load.level];
        const owned = activeByDeveloper.get(load.developer.id) ?? [];
        return (
          <li key={load.developer.id}>
            <Card size="sm" className="gap-3 px-(--card-spacing) shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <div className="flex min-w-0 items-center gap-3">
                  <InitialsAvatar name={load.developer.name} />
                  <div className="min-w-0 leading-tight">
                    {canManage ? (
                      <Link
                        href={`${base}/mine?developerId=${load.developer.id}`}
                        className="font-medium underline-offset-4 hover:text-link hover:underline"
                      >
                        {load.developer.name}
                      </Link>
                    ) : (
                      <p className="font-medium">{load.developer.name}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {load.active} {load.active === 1 ? 'activa' : 'activas'} · {signed(load.vsAverage)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {load.stalled !== null && load.stalled > 0 && (
                    <Badge variant="destructive">
                      <TriangleAlert aria-hidden /> {load.stalled} {load.stalled === 1 ? 'estancada' : 'estancadas'}
                    </Badge>
                  )}
                  {level && (
                    <Badge variant="secondary" className={level.tone}>
                      <level.icon aria-hidden /> {level.label}
                    </Badge>
                  )}
                </div>
              </div>

              <LoadBar load={load} max={maxTotal} />
              <p className="text-xs text-muted-foreground">
                {SEGMENTS.map((s) => `${load[s.key]} ${s.label.toLowerCase()}`).join(' · ')}
              </p>

              {canEdit && owned.length > 0 && (
                <details className="group rounded-lg border bg-muted/30">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium select-none hover:bg-muted/60">
                    <span>
                      Ver y reasignar sus {owned.length} {owned.length === 1 ? 'OVA activa' : 'OVAs activas'}
                    </span>
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="flex flex-col gap-2 border-t p-3">
                    <CheckAll label={`Marcar todas las de ${load.developer.name}`} />
                    <ul className="flex flex-col divide-y">
                      {owned.map((ova) => (
                        <li key={ova.id}>
                          <label className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                            <input
                              type="checkbox"
                              name="ids"
                              value={ova.id}
                              className="size-4 accent-[var(--color-primary)]"
                            />
                            <span className="min-w-0 font-medium break-words">{ova.repoName}</span>
                            <Badge variant="secondary">{ova.school.name}</Badge>
                            <StatusBadge status={ova.status} />
                            {stalledIds?.has(ova.id) && (
                              <Badge variant="destructive">
                                <TriangleAlert aria-hidden /> Estancada
                              </Badge>
                            )}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Carga de trabajo"
        description="Cuántas OVAs lleva cada persona y quién tiene hueco. La carga cuenta las OVAs en desarrollo y en revisión."
      />

      {params.ok && <Alert variant="success" title={params.ok} />}
      {params.error && (
        <Alert variant="error" title="No se pudo reasignar">
          {params.error}
        </Alert>
      )}
      {!health.ok && (
        <Alert variant="warning" title="Sin datos de actividad de GitHub">
          {health.error} La carga se calcula igual, pero no se marcan las OVAs estancadas.
        </Alert>
      )}

      {developers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Todavía no hay desarrolladores"
          description="Agrégalos en Administración para ver cómo se reparte el trabajo."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="OVAs activas" value={report.totalActive} hint="En desarrollo y en revisión" icon={Hammer} />
            <StatTile
              label="Promedio por persona"
              value={number.format(report.averageActive)}
              hint={`Entre ${developers.length} ${developers.length === 1 ? 'desarrollador' : 'desarrolladores'}`}
              icon={Scale}
            />
            <StatTile
              label="Con más carga"
              value={busiest ? busiest.active : '—'}
              hint={busiest ? busiest.developer.name : 'Nadie lleva OVAs activas'}
              icon={TriangleAlert}
            />
            <StatTile
              label="Sin carga"
              value={report.withoutLoad}
              hint={report.withoutLoad === 1 ? 'Persona sin OVAs activas' : 'Personas sin OVAs activas'}
              icon={UserRoundCheck}
            />
          </div>

          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
            {SEGMENTS.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5">
                <span className={`${s.bar} size-2.5 rounded-[3px]`} aria-hidden />
                <s.icon className="size-3.5" aria-hidden /> {s.label}
              </li>
            ))}
          </ul>

          {canEdit ? (
            <form action={reassignOvasAction} className="flex flex-col gap-3">
              <input type="hidden" name="project" value={project.slug} />
              <input type="hidden" name="returnTo" value={`${base}/workload`} />
              {content}
              <ReassignBar
                developers={[...developers]
                  // Quien más hueco tiene, primero: es a quien se suele querer pasar trabajo
                  .sort((a, b) => a.active - b.active || a.developer.name.localeCompare(b.developer.name, 'es'))
                  .map((d) => ({ id: d.developer.id, name: d.developer.name, active: d.active }))}
              />
            </form>
          ) : (
            content
          )}

          <p className="text-xs text-muted-foreground">
            «Carga alta» es una persona con al menos 1,5 veces el promedio (y 2 OVAs más); «Con hueco», con la mitad o
            menos (y 2 menos). Reasignar solo cambia quién lleva la OVA en el registro: GitHub no se toca y cada cambio
            queda en la actividad.
          </p>
        </>
      )}
    </div>
  );
}
