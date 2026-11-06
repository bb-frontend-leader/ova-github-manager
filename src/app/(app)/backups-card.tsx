import { AlertTriangle, DatabaseBackup } from 'lucide-react';
import { Alert } from '@/components/alert';
import { BackupButton } from '@/components/backup-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { lastBackupFailure } from '@/lib/backup-scheduler';
import { absoluteFormat, currentTime, formatBytes, relativeDate } from '@/lib/format';
import { getServices } from '@/lib/services';
import { backupNowAction } from './backups-actions';

function everyLabel(intervalMs: number): string {
  const hours = intervalMs / (60 * 60 * 1000);
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? 'cada día' : `cada ${days} días`;
  }
  return hours === 1 ? 'cada hora' : `cada ${hours} horas`;
}

/** Estado de las copias de seguridad de la base de datos (solo super administradores). */
export async function BackupsCard({ backupOk, backupError }: { backupOk?: boolean; backupError?: string }) {
  const { backups, backupDir } = getServices();
  const status = await backups.status();
  const failure = lastBackupFailure();
  const now = currentTime();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup className="size-4" aria-hidden /> Copias de seguridad
        </CardTitle>
        <CardDescription>
          {status.enabled
            ? `Se copia la base de datos ${everyLabel(status.intervalMs)} y se conservan las últimas ${status.keep}.`
            : `Las copias automáticas están desactivadas (BACKUP_INTERVAL_HOURS=0). Se conservan las últimas ${status.keep} de las manuales.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {backupOk && <Alert variant="success" title="Copia hecha." />}
        {backupError && <Alert variant="error" title="No se pudo hacer la copia">{backupError}</Alert>}
        {failure && (
          <Alert variant="error" title="La última copia automática falló">
            {failure.message} ({relativeDate(failure.at, now)})
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {status.latest ? (
              <>
                Última copia:{' '}
                <span className="font-medium" title={absoluteFormat.format(new Date(status.latest.createdAt))}>
                  {relativeDate(status.latest.createdAt, now)}
                </span>{' '}
                <span className="text-muted-foreground">({formatBytes(status.latest.sizeBytes)})</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <AlertTriangle className="size-4" aria-hidden /> Aún no hay ninguna copia.
              </span>
            )}
          </p>
          <form action={backupNowAction}>
            <BackupButton />
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          {status.snapshots.length} {status.snapshots.length === 1 ? 'copia guardada' : 'copias guardadas'} en{' '}
          <code className="break-all">{backupDir}</code>. Guárdalas también fuera de este servidor.
        </p>
      </CardContent>
    </Card>
  );
}
