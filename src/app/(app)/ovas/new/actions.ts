'use server';

import { authorizeAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';
import { getServices } from '@/lib/services';

export type CreateOvaState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; repoName: string; url: string; warnings: string[] };

export async function createOvaAction(
  _previous: CreateOvaState,
  formData: FormData,
): Promise<CreateOvaState> {
  // Se autoriza aquí, junto a la acción: nunca se confía en que la página ya lo hizo
  const authz = await authorizeAction('ova:create');
  if (!authz.ok) return { status: 'error', message: authz.message };

  const rawName = String(formData.get('rawName') ?? '');
  const schoolId = Number(formData.get('schoolId'));
  const developerId = Number(formData.get('developerId'));

  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    return { status: 'error', message: 'Selecciona una escuela.' };
  }
  if (!Number.isInteger(developerId) || developerId <= 0) {
    return { status: 'error', message: 'Selecciona un desarrollador.' };
  }

  try {
    const result = await getServices().createOva.execute({
      rawName,
      schoolId,
      developerId,
      createdBy: authz.user.login,
    });

    if (!result.success) return { status: 'error', message: translateError(result.message) };

    return {
      status: 'success',
      repoName: result.repositoryName,
      url: result.repositoryUrl,
      warnings: result.warnings,
    };
  } catch (error) {
    console.error('[createOvaAction]', error);
    return { status: 'error', message: 'Ocurrió un error inesperado. Inténtalo de nuevo.' };
  }
}
