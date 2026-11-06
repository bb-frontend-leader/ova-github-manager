import { CircleCheck, GitBranch, ListChecks, Wrench } from 'lucide-react';
import type { RepairIssue, ReconcileReport } from '@/core';
import { REPAIR_BATCH_SIZE } from '@/core';
import { Alert } from '@/components/alert';
import { StatTile } from '@/components/dataviz/stat-tile';
import { EmptyState } from '@/components/empty-state';
import { NativeSelect } from '@/components/native-select';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireProjectPermission } from '@/lib/dal';
import { translateError } from '@/lib/messages';
import { adoptOvaAction, repairAllAction, repairOvaAction } from './actions';

export const metadata = { title: 'Reparar' };

/** Cuántos repositorios sin registrar se muestran a la vez. */
const UNREGISTERED_LIMIT = 60;

const ISSUE_LABELS: Record<RepairIssue, string> = {
  missing_topic: 'Sin topic de escuela',
  missing_team: 'Sin team',
  insufficient_permission: 'Permiso del team insuficiente',
};

export default async function ReconcilePage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ ok?: string; error?: string; warn?: string }>;
}) {
  const { project: slug } = await params;
  const access = await requireProjectPermission(slug, 'catalog:manage');
  const { project, services } = access;
  const messages = await searchParams;

  const [schools, developers] = await Promise.all([
    services.store.listSchools(),
    services.store.listDevelopers(),
  ]);

  let report: ReconcileReport | null = null;
  let scanError: string | null = null;
  try {
    report = await services.reconcile.scan();
  } catch (error) {
    console.error('[reconcile scan]', error);
    scanError = translateError(error);
  }

  const shownUnregistered = report?.unregistered.slice(0, UNREGISTERED_LIMIT) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reparar"
        description={`Compara ${project.org} en GitHub con el registro: completa lo que quedó a medias y registra los repositorios que la herramienta no conoce.`}
      />

      {messages.ok && <Alert variant="success" title={messages.ok} />}
      {messages.warn && (
        <Alert variant="warning" title="Revisa esto">
          {messages.warn}
        </Alert>
      )}
      {messages.error && (
        <Alert variant="error" title="No se pudo completar la acción">
          {messages.error}
        </Alert>
      )}
      {scanError && (
        <Alert variant="error" title="No se pudo revisar GitHub">
          {scanError}
        </Alert>
      )}

      {report && (
        <>
          {report.teamError && (
            <Alert variant="warning" title={`No se pudo revisar el team ${project.defaultTeam}`}>
              {translateError(report.teamError)} Mientras tanto solo se revisan los topics. Comprueba que
              el team exista en la organización y que la herramienta tenga acceso a él.
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile icon={GitBranch} label="Repositorios revisados" value={report.checked} hint={project.org} />
            <StatTile
              icon={Wrench}
              label="OVAs por corregir"
              value={report.repairs.length}
              hint={report.repairs.length === 0 ? 'Todo en orden' : 'Les falta topic o team'}
            />
            <StatTile
              icon={ListChecks}
              label="Sin registrar"
              value={report.unregistered.length}
              hint="Existen en GitHub, no en la herramienta"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>OVAs por corregir</CardTitle>
              <CardDescription>
                Cada OVA debe tener el topic de su escuela y el team {project.defaultTeam} con permiso de
                escritura. Solo se añade lo que falta: no se quitan topics ni se baja ningún permiso.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {report.repairs.length === 0 ? (
                <EmptyState
                  icon={CircleCheck}
                  title="Todas las OVAs registradas están en orden"
                  description="Todas tienen el topic de su escuela y el team con el permiso correcto."
                />
              ) : (
                <>
                  <form action={repairAllAction} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="project" value={project.slug} />
                    <Button type="submit">
                      <Wrench aria-hidden />
                      Corregir{' '}
                      {report.repairs.length > REPAIR_BATCH_SIZE
                        ? `las primeras ${REPAIR_BATCH_SIZE}`
                        : `las ${report.repairs.length}`}
                    </Button>
                    {report.repairs.length > REPAIR_BATCH_SIZE && (
                      <p className="text-sm text-muted-foreground">
                        Se hace por tandas para no saturar a GitHub; repite hasta que no quede ninguna.
                      </p>
                    )}
                  </form>
                  <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
                    {report.repairs.map(({ ova, issues, teamPermission }) => (
                      <li key={ova.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <a
                            href={ova.repoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium break-words text-link underline-offset-4 hover:underline"
                          >
                            {ova.repoName}
                            <span className="sr-only"> (abre GitHub en una pestaña nueva)</span>
                          </a>
                          <div className="flex flex-wrap gap-1.5">
                            {issues.map((issue) => (
                              <Badge key={issue} variant="destructive">
                                {ISSUE_LABELS[issue]}
                                {issue === 'insufficient_permission' && teamPermission
                                  ? ` (${teamPermission})`
                                  : ''}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <form action={repairOvaAction}>
                          <input type="hidden" name="project" value={project.slug} />
                          <input type="hidden" name="repoName" value={ova.repoName} />
                          <Button type="submit" variant="outline" size="sm" aria-label={`Corregir ${ova.repoName}`}>
                            Corregir
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Repositorios sin registrar</CardTitle>
              <CardDescription>
                Repositorios de {project.org} que la herramienta no conoce, por ejemplo porque GitHub
                respondió con error al crearlos. Al registrarlos se les añade el topic de su escuela y el
                team. Los que parecen OVAs van primero; ignora los que no lo sean.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {report.unregistered.length === 0 ? (
                <EmptyState
                  icon={CircleCheck}
                  title="No hay repositorios sin registrar"
                  description="Todo lo que hay en la organización está en el registro."
                />
              ) : schools.length === 0 || developers.length === 0 ? (
                <Alert variant="info" title="Antes hay que crear el catálogo">
                  Para registrar un repositorio hace falta al menos una escuela y un desarrollador. Créalos
                  en Administración.
                </Alert>
              ) : (
                <>
                  <ul className="divide-y rounded-lg ring-1 ring-foreground/10">
                    {shownUnregistered.map((repo) => (
                      <li key={repo.name} className="flex flex-col gap-2 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium break-words text-link underline-offset-4 hover:underline"
                          >
                            {repo.name}
                            <span className="sr-only"> (abre GitHub en una pestaña nueva)</span>
                          </a>
                          {repo.probableOva && <Badge variant="default">Parece una OVA</Badge>}
                          {repo.topics.map((topic) => (
                            <Badge key={topic} variant="outline">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                        <form action={adoptOvaAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="project" value={project.slug} />
                          <input type="hidden" name="repoName" value={repo.name} />
                          <NativeSelect
                            name="schoolId"
                            aria-label={`Escuela de ${repo.name}`}
                            defaultValue={repo.suggestedSchool?.id ?? ''}
                            required
                            className="w-auto min-w-44"
                          >
                            <option value="" disabled>
                              Escuela…
                            </option>
                            {schools.map((school) => (
                              <option key={school.id} value={school.id}>
                                {school.name}
                              </option>
                            ))}
                          </NativeSelect>
                          <NativeSelect
                            name="developerId"
                            aria-label={`Desarrollador de ${repo.name}`}
                            defaultValue=""
                            required
                            className="w-auto min-w-44"
                          >
                            <option value="" disabled>
                              Desarrollador…
                            </option>
                            {developers.map((developer) => (
                              <option key={developer.id} value={developer.id}>
                                {developer.name}
                              </option>
                            ))}
                          </NativeSelect>
                          <Button type="submit" size="sm" aria-label={`Registrar ${repo.name}`}>
                            Registrar
                          </Button>
                        </form>
                      </li>
                    ))}
                  </ul>
                  {report.unregistered.length > shownUnregistered.length && (
                    <p className="text-sm text-muted-foreground">
                      Se muestran {shownUnregistered.length} de {report.unregistered.length}. Registra o
                      descarta estos para ver el resto.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
