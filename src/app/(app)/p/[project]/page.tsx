import { Suspense } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Inbox,
  Pencil,
  Search,
  Target,
} from 'lucide-react';
import { can } from '@/core';
import { InitialsAvatar } from '@/components/initials-avatar';
import { Alert } from '@/components/alert';
import { EmptyState } from '@/components/empty-state';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Meter } from '@/components/dataviz/meter';
import { RankedBars } from '@/components/dataviz/ranked-bars';
import { StatTile } from '@/components/dataviz/stat-tile';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { autoSyncIfDue, lastSyncAt } from '@/lib/auto-sync';
import { withBasePath } from '@/lib/base-path';
import { requireProjectPermission } from '@/lib/dal';
import { absoluteFormat, currentTime, relativeDate } from '@/lib/format';
import { filterOvas, parseOvaQuery } from '@/lib/ova-filter';
import { StatusBadge } from '@/components/status-badge';
import { SyncButton } from '@/components/sync-button';
import { OVA_STATUSES, STATUS_LABELS } from '@/lib/ova-status';
import { syncOvasAction } from './actions';
import { AttentionCard, AttentionFallback } from './attention-card';

const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;

function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

function buildHref(base: string, params: Record<string, string | number | undefined>): string {
  return `${base}${queryString(params)}#ovas`;
}

const DISABLED_LINK =' pointer-events-none opacity-50';

export default async function DashboardPage({
  params: routeParams,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{
    schoolId?: string;
    developerId?: string;
    status?: string;
    q?: string;
    page?: string;
    denied?: string;
    synced?: string;
    removed?: string;
    count?: string;
    syncError?: string;
  }>;
}) {
  const { project: slug } = await routeParams;
  const access = await requireProjectPermission(slug, 'ova:view');
  const { project, role } = access;
  const { store } = access.services;
  const base = `/p/${project.slug}`;

  const params = await searchParams;
  const ovaQuery = parseOvaQuery(params);
  const { schoolId, developerId, status, q: query } = ovaQuery;
  const removedCount = Math.max(0, Math.trunc(Number(params.count)) || 0);
  const removedNames = (params.removed ?? '').split(',').filter(Boolean);

  // Antes de leer el registro: quita las OVAs borradas en GitHub (como mucho cada 5 min)
  const autoSynced = await autoSyncIfDue(project);
  const autoRemoved = autoSynced?.removed ?? [];

  const [stats, all, schools, developers] = await Promise.all([
    store.stats(),
    store.list({}),
    store.listSchools(),
    store.listDevelopers(),
  ]);

  const now = currentTime();
  const syncedAt = lastSyncAt(project.id);
  const target = project.total;
  const percent = target > 0 ? Math.min(100, Math.round((stats.total / target) * 100)) : 0;
  const remaining = Math.max(0, target - stats.total);
  const lastWeek = all.filter((ova) => now - new Date(ova.createdAt).getTime() < 7 * DAY_MS).length;
  const latest = all.reduce<(typeof all)[number] | undefined>(
    (best, ova) => (!best || ova.createdAt > best.createdAt ? ova : best),
    undefined,
  );

  const filtered = filterOvas(all, ovaQuery);

  const hasFilter =
    schoolId !== undefined || developerId !== undefined || status !== undefined || query !== '';
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(parsePage(params.page), pageCount);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canCreate = can(role, 'ova:create');
  const canEdit = can(role, 'ova:edit');
  const baseParams = { schoolId, developerId, status, q: query };
  const exportHref = `${base}/export${queryString(baseParams)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Panel"
        description={`Avance de las OVAs de ${project.name} y su reparto por escuela y desarrollador.`}
        actions={
          canCreate && (
            <>
              <form action={syncOvasAction}>
                <input type="hidden" name="project" value={project.slug} />
                <SyncButton />
              </form>
              <Link href={`${base}/ovas/new`} className={buttonVariants()}>
                Crear OVA
              </Link>
            </>
          )
        }
      />

      {autoRemoved.length > 0 && (
        <Alert
          variant="info"
          title={`Se quitaron ${autoRemoved.length} ${autoRemoved.length === 1 ? 'OVA' : 'OVAs'} que ya no existen en GitHub`}
        >
          <p className="break-words">{autoRemoved.map((ova) => ova.repoName).join(', ')}</p>
        </Alert>
      )}

      {params.syncError && (
        <Alert variant="error" title="No se pudo sincronizar con GitHub">
          {params.syncError}
        </Alert>
      )}

      {params.synced !== undefined && !params.syncError && (
        <Alert
          variant="success"
          title={
            removedCount === 0
              ? `Todo al día: las ${params.synced} OVAs registradas siguen en GitHub`
              : `Sincronizado: se quitaron ${removedCount} ${removedCount === 1 ? 'OVA' : 'OVAs'} que ya no existen en GitHub`
          }
        >
          {removedCount > 0 && <p className="break-words">{removedNames.join(', ')}</p>}
        </Alert>
      )}

      {params.denied && (
        <Alert variant="error" title="No tienes acceso a esa sección">
          Tu rol actual no incluye ese permiso. Si lo necesitas, pídeselo a un administrador.
        </Alert>
      )}

      <Card>
        <CardContent className="flex flex-col gap-5 pt-1">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
            <div>
              <p className="text-sm text-muted-foreground">OVAs creadas</p>
              <p className="mt-1 flex items-baseline gap-2">
                <span className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">{stats.total}</span>
                <span className="text-xl text-muted-foreground tabular-nums">de {target}</span>
              </p>
            </div>
            <p className="text-right">
              <span className="text-3xl font-semibold tabular-nums">{percent}%</span>
              <span className="block text-sm text-muted-foreground">del objetivo</span>
            </p>
          </div>
          <Meter value={stats.total} max={target} label="OVAs creadas" />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={Target}
          label="Por crear"
          value={remaining}
          hint={remaining === 0 ? 'Objetivo cumplido' : `Para llegar a ${target}`}
        />
        <StatTile
          icon={CalendarDays}
          label="Últimos 7 días"
          value={lastWeek}
          hint={lastWeek === 1 ? 'OVA creada' : 'OVAs creadas'}
        />
        <StatTile
          icon={CalendarClock}
          label="Última OVA"
          value={latest ? relativeDate(latest.createdAt, now) : '—'}
          hint={latest ? latest.repoName : 'Aún no hay OVAs registradas'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por escuela</CardTitle>
            <CardDescription>Selecciona una escuela para ver sus OVAs.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankedBars
              label="OVAs por escuela"
              empty="Aún no hay escuelas. Un administrador puede crearlas en Administración."
              items={stats.bySchool.map(({ school, count }) => ({
                id: school.id,
                label: school.name,
                count,
                href: buildHref(base, { schoolId: school.id }),
                hrefLabel: `${school.name}: ${count} OVAs. Ver listado`,
              }))}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Por desarrollador</CardTitle>
            <CardDescription>Selecciona una persona para ver su trabajo.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankedBars
              label="OVAs por desarrollador"
              empty="Aún no hay desarrolladores. Un administrador puede registrarlos en Administración."
              items={stats.byDeveloper.map(({ developer, count }) => ({
                id: developer.id,
                label: developer.name,
                count,
                leading: <InitialsAvatar name={developer.name} className="size-6 text-[0.65rem]" />,
                href: buildHref(base, { developerId: developer.id }),
                hrefLabel: `${developer.name}: ${count} OVAs. Ver listado`,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por estado</CardTitle>
            <CardDescription>Selecciona un estado para ver sus OVAs.</CardDescription>
          </CardHeader>
          <CardContent>
            <RankedBars
              label="OVAs por estado"
              empty="Aún no hay OVAs."
              items={stats.byStatus.map(({ status: s, count }) => ({
                id: s,
                label: STATUS_LABELS[s],
                count,
                href: buildHref(base, { status: s }),
                hrefLabel: `${STATUS_LABELS[s]}: ${count} OVAs. Ver listado`,
              }))}
            />
            <Link href={`${base}/board`} className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-4' })}>
              Abrir el tablero
            </Link>
          </CardContent>
        </Card>
        <Suspense fallback={<AttentionFallback />}>
          <AttentionCard services={access.services} base={base} />
        </Suspense>
      </div>

      <Card id="ovas" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>
            OVAs{' '}
            <span className="font-normal text-muted-foreground">
              ({hasFilter ? `${filtered.length} de ${all.length}` : all.length})
            </span>
          </CardTitle>
          <CardDescription>
            {syncedAt === null
              ? 'Aún sin sincronizar con GitHub en esta sesión del servidor.'
              : `Sincronizado con GitHub ${relativeDate(new Date(syncedAt).toISOString(), now)}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            method="get"
            action={withBasePath(base)}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_1fr_auto]"
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
                  defaultValue={query}
                  placeholder="Repositorio, escuela o persona"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schoolId">Escuela</Label>
              <NativeSelect id="schoolId" name="schoolId" defaultValue={schoolId ?? ''}>
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
              <NativeSelect id="developerId" name="developerId" defaultValue={developerId ?? ''}>
                <option value="">Todos</option>
                {developers.map((developer) => (
                  <option key={developer.id} value={developer.id}>
                    {developer.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Estado</Label>
              <NativeSelect id="status" name="status" defaultValue={status ?? ''}>
                <option value="">Todos</option>
                {OVA_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="secondary">
                Filtrar
              </Button>
              {hasFilter && (
                <Link href={`${base}#ovas`} className={buttonVariants({ variant: 'ghost' })}>
                  Limpiar
                </Link>
              )}
            </div>
          </form>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {hasFilter ? 'La exportación respeta los filtros aplicados.' : 'Descarga todas las OVAs con el enlace de cada repositorio.'}
              </p>
              {/* Es una descarga, no una página: <a> normal, sin enrutador de Next */}
              <a href={withBasePath(exportHref)} download className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                <Download aria-hidden /> Exportar CSV ({filtered.length})
              </a>
            </div>
          )}

          {rows.length === 0 ? (
            hasFilter ? (
              <EmptyState
                icon={Search}
                title="Ninguna OVA coincide con tu búsqueda"
                description="Prueba con otro nombre o quita algún filtro para ver más resultados."
                action={
                  <Link href={`${base}#ovas`} className={buttonVariants({ variant: 'outline' })}>
                    Quitar filtros
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="Todavía no hay OVAs registradas"
                description={
                  canCreate
                    ? 'Crea la primera y quedará registrada aquí con su escuela y su desarrollador.'
                    : 'Cuando alguien cree la primera OVA aparecerá aquí.'
                }
                action={
                  canCreate && (
                    <Link href={`${base}/ovas/new`} className={buttonVariants()}>
                      Crear la primera OVA
                    </Link>
                  )
                }
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Repositorio</TableHead>
                      <TableHead>Escuela</TableHead>
                      <TableHead>Desarrollador</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Creada por</TableHead>
                      <TableHead className="text-right">Creada</TableHead>
                      {canEdit && (
                        <TableHead className="w-12">
                          <span className="sr-only">Acciones</span>
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((ova) => (
                      <TableRow key={ova.id}>
                        <TableCell>
                          <a
                            href={ova.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-link underline-offset-4 hover:underline"
                          >
                            {ova.repoName}
                            <span className="sr-only"> (abre GitHub en una pestaña nueva)</span>
                          </a>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ova.school.name}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <InitialsAvatar name={ova.developer.name} className="size-6 text-[0.65rem]" />
                            {ova.developer.name}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={ova.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">@{ova.createdBy}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <time dateTime={ova.createdAt} title={absoluteFormat.format(new Date(ova.createdAt))}>
                            {relativeDate(ova.createdAt, now)}
                          </time>
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <Link
                              href={`${base}/ovas/${ova.id}/edit`}
                              aria-label={`Editar ${ova.repoName}`}
                              title="Editar escuela o desarrollador"
                              className={buttonVariants({ variant: 'ghost', size: 'icon' })}
                            >
                              <Pencil aria-hidden />
                            </Link>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pageCount > 1 && (
                <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    Página {page} de {pageCount}
                  </p>
                  <div className="flex gap-2">
                    {page > 1 ? (
                      <Link
                        href={buildHref(base, { ...baseParams, page: page - 1 })}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        <ChevronLeft aria-hidden /> Anterior
                      </Link>
                    ) : (
                      <span
                        aria-disabled
                        className={buttonVariants({ variant: 'outline', size: 'sm' }) + DISABLED_LINK}
                      >
                        <ChevronLeft aria-hidden /> Anterior
                      </span>
                    )}
                    {page < pageCount ? (
                      <Link
                        href={buildHref(base, { ...baseParams, page: page + 1 })}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        Siguiente <ChevronRight aria-hidden />
                      </Link>
                    ) : (
                      <span
                        aria-disabled
                        className={buttonVariants({ variant: 'outline', size: 'sm' }) + DISABLED_LINK}
                      >
                        Siguiente <ChevronRight aria-hidden />
                      </span>
                    )}
                  </div>
                </nav>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
