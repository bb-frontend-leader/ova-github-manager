import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { changeStatusAction } from '@/app/(app)/p/[project]/actions';
import { STATUS_LABELS, neighbours, type OvaStatus } from '@/lib/ova-status';

function MoveForm({
  project,
  ovaId,
  returnTo,
  target,
  label,
  children,
}: {
  project: string;
  ovaId: number;
  returnTo: string;
  target: OvaStatus;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={changeStatusAction}>
      <input type="hidden" name="project" value={project} />
      <input type="hidden" name="id" value={ovaId} />
      <input type="hidden" name="status" value={target} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" variant="outline" size="icon-sm" aria-label={label} title={label}>
        {children}
      </Button>
    </form>
  );
}

/** Mueve una OVA al estado anterior o al siguiente. Funciona sin JavaScript. */
export function StatusMover({
  project,
  ovaId,
  repoName,
  status,
  returnTo,
}: {
  project: string;
  ovaId: number;
  repoName: string;
  status: OvaStatus;
  /** Ruta de este mismo proyecto a la que volver (con sus filtros) */
  returnTo: string;
}) {
  const { previous, next } = neighbours(status);
  return (
    <div className="flex items-center gap-1">
      {previous && (
        <MoveForm
          project={project}
          ovaId={ovaId}
          returnTo={returnTo}
          target={previous}
          label={`Devolver ${repoName} a "${STATUS_LABELS[previous]}"`}
        >
          <ChevronLeft aria-hidden />
        </MoveForm>
      )}
      {next && (
        <MoveForm
          project={project}
          ovaId={ovaId}
          returnTo={returnTo}
          target={next}
          label={`Pasar ${repoName} a "${STATUS_LABELS[next]}"`}
        >
          <ChevronRight aria-hidden />
        </MoveForm>
      )}
    </div>
  );
}
