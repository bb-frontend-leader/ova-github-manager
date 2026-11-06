'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authorizeSuperAdminAction } from '@/lib/dal';
import { recordBackupFailure, recordBackupSuccess } from '@/lib/backup-scheduler';
import { translateError } from '@/lib/messages';
import { getServices } from '@/lib/services';

/** Hace una copia de seguridad ahora (solo super administradores). */
export async function backupNowAction() {
  const authz = await authorizeSuperAdminAction();
  if (!authz.ok) redirect(`/?backupError=${encodeURIComponent(authz.message)}`);

  let target: string;
  try {
    await getServices().backups.runNow();
    recordBackupSuccess();
    target = '/?backupOk=1';
  } catch (error) {
    recordBackupFailure(error);
    target = `/?backupError=${encodeURIComponent(translateError(error))}`;
  }
  revalidatePath('/');
  redirect(target);
}
