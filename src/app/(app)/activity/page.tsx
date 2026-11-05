import Link from 'next/link';
import { ChevronLeft, ChevronRight, History, Search } from 'lucide-react';
import type { AuditAction, AuditEntry } from '@/core';
import { EmptyState } from '@/components/empty-state';
import { InitialsAvatar } from '@/components/initials-avatar';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { requirePagePermission } from '@/lib/dal';
import { absoluteFormat, currentTime, relativeDate } from '@/lib/format';
import { getServices } from '@/lib/services';

export const metadata = { title: 'Actividad' };

const PAGE_SIZE = 50;

const ACTIONS: Record<AuditAction, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  'ova.created': { label: 'Creada', variant: 'default' },
  'ova.updated': { label: 'Editada', variant: 'secondary' },
  'ova.removed': { label: 'Quitada', variant: 'destructive' },
};

function isAction(value: string | undefined): value is AuditAction {
  return value !== undefined && value in ACTIONS;
}

function parsePage(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function href(params: { q?: string; action?: string; page?: number }): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.action) search.set('action', params.action);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const query = search.toString();
  return query ? `/activity?${query}` : '/activity';
}

function Detail({ entry }: { entry: AuditEntry }) {
  const { details } = entry;
  if (entry.action === 'ova.updated' && details.changes?.length) {
    return (
      <ul className="flex flex-col gap-0.5">
        {details.changes.map((change) => (
          <li key={change.field}>
            <span className="text-muted-foreground">
              {change.field === 'school' ? 'Escuela' : 'Desarrollador'}:
            </span>{' '}
            {change.from} <span aria-label="cambió a">→</span> <span className="font-medium">{change.to}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (entry.action === 'ova.removed') {
    return (
      <span className="text-muted-foreground">
        El repositorio ya no existe en GitHub
        {details.school && details.developer ? ` · ${details.school} · ${details.developer}` : ''}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {[details.school, details.developer].filter(Boolean).join(' · ') || '—'}
    </span>
  );
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; action?: string; page?: string }>;
}) {
  await requirePagePermission('ova:view');

  const params = await searchParams;
  const q = (params.q ?? '').trim();
  const action = isAction(params.action) ? params.action : undefined;
  const requested = parsePage(params.page);

  const { store } = getServices();
  let result = await store.listActivity({ action, search: q }, PAGE_SIZE, (requested - 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const page = Math.min(requested, pageCount);
  if (page !== requested) {
    result = await store.listActivity({ action, search: q }, PAGE_SIZE, (page - 1) * PAGE_SIZE);
  }

  const now = currentTime();
  const hasFilter = q !== '' || action !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Actividad"
        description="Quién creó, editó o quitó cada OVA, y cuándo. Lo más reciente aparece primero."
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <form method="get" action="/activity" className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="q">Buscar</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input id="q" name="q" type="search" defaultValue={q} placeholder="Repositorio o persona" className="pl-9" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="action">Acción</Label>
              <NativeSelect id="action" name="action" defaultValue={action ?? ''}>
                <option value="">Todas</option>
                {(Object.keys(ACTIONS) as AuditAction[]).map((key) => (
                  <option key={key} value={key}>
                    {ACTIONS[key].label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" variant="secondary">
                Filtrar
              </Button>
              {hasFilter && (
                <Link href="/activity" className={buttonVariants({ variant: 'ghost' })}>
                  Limpiar
                </Link>
              )}
            </div>
          </form>

          {result.entries.length === 0 ? (
            hasFilter ? (
              <EmptyState
                icon={Search}
                title="Ningún movimiento coincide"
                description="Prueba con otro nombre o quita algún filtro."
                action={
                  <Link href="/activity" className={buttonVariants({ variant: 'outline' })}>
                    Quitar filtros
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={History}
                title="Todavía no hay actividad"
                description="Aquí aparecerá cada OVA que se cree, se edite o se quite del registro. Empieza a registrarse desde ahora."
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuándo</TableHead>
                      <TableHead>Quién</TableHead>
                      <TableHead>Acción</TableHead>
                      <TableHead>OVA</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.entries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          <time dateTime={entry.at} title={absoluteFormat.format(new Date(entry.at))}>
                            {relativeDate(entry.at, now)}
                          </time>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <InitialsAvatar name={entry.actor} className="size-6 text-[0.65rem]" />
                            {entry.actor === 'sistema' ? 'Sistema' : `@${entry.actor}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTIONS[entry.action]?.variant ?? 'secondary'}>
                            {ACTIONS[entry.action]?.label ?? entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <a
                            href={entry.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-link underline-offset-4 hover:underline"
                          >
                            {entry.repoName}
                            <span className="sr-only"> (abre GitHub en una pestaña nueva)</span>
                          </a>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          <Detail entry={entry} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pageCount > 1 && (
                <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm">
                  <p className="text-muted-foreground">
                    Página {page} de {pageCount} · {result.total} movimientos
                  </p>
                  <div className="flex gap-2">
                    {page > 1 ? (
                      <Link href={href({ q, action, page: page - 1 })} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        <ChevronLeft aria-hidden /> Anterior
                      </Link>
                    ) : (
                      <span aria-disabled className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' pointer-events-none opacity-50'}>
                        <ChevronLeft aria-hidden /> Anterior
                      </span>
                    )}
                    {page < pageCount ? (
                      <Link href={href({ q, action, page: page + 1 })} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                        Siguiente <ChevronRight aria-hidden />
                      </Link>
                    ) : (
                      <span aria-disabled className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' pointer-events-none opacity-50'}>
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
