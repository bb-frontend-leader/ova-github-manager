'use server';

import { redirect } from 'next/navigation';
import { authorizeSuperAdminAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';
import { getServices } from '@/lib/services';

export type ProjectFormValues = Record<
  'name' | 'org' | 'slug' | 'template' | 'defaultTeam' | 'descriptionPrefix' | 'total',
  string
>;

export type ProjectFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; values: ProjectFormValues; attempt: number };

function readValues(formData: FormData): ProjectFormValues {
  const text = (key: keyof ProjectFormValues) => String(formData.get(key) ?? '');
  return {
    name: text('name'),
    org: text('org'),
    slug: text('slug'),
    template: text('template'),
    defaultTeam: text('defaultTeam'),
    descriptionPrefix: text('descriptionPrefix'),
    total: text('total'),
  };
}

function failure(message: string, values: ProjectFormValues): ProjectFormState {
  return { status: 'error', message, values, attempt: Date.now() };
}

/**
 * Da de alta un proyecto (solo super administradores). Comprueba con GitHub que la organización
 * es accesible. `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
export async function createProjectAction(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const values = readValues(formData);
  const authz = await authorizeSuperAdminAction();
  if (!authz.ok) return failure(authz.message, values);

  let target: string;
  try {
    const { project, warnings } = await getServices().manageProjects.create({
      name: values.name,
      org: values.org,
      slug: values.slug,
      template: values.template || undefined,
      defaultTeam: values.defaultTeam || undefined,
      descriptionPrefix: values.descriptionPrefix || undefined,
      total: values.total,
    });
    const query = new URLSearchParams({ ok: `Proyecto "${project.name}" creado.` });
    if (warnings.length > 0) query.set('warn', warnings.join(' '));
    target = `/p/${project.slug}/settings?${query}`;
  } catch (error) {
    console.error('[createProjectAction]', error);
    return failure(translateError(error), values);
  }

  redirect(target);
}

/** Edita nombre, plantilla, team, prefijo y objetivo de un proyecto (solo super administradores). */
export async function updateProjectAction(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const values = readValues(formData);
  const projectId = Number(formData.get('projectId'));
  const authz = await authorizeSuperAdminAction();
  if (!authz.ok) return failure(authz.message, values);

  let target: string;
  try {
    const { project, warnings } = await getServices().manageProjects.update(projectId, {
      name: values.name,
      template: values.template,
      defaultTeam: values.defaultTeam,
      descriptionPrefix: values.descriptionPrefix,
      total: values.total,
    });
    const query = new URLSearchParams({ ok: 'Cambios guardados.' });
    if (warnings.length > 0) query.set('warn', warnings.join(' '));
    target = `/p/${project.slug}/settings?${query}`;
  } catch (error) {
    console.error('[updateProjectAction]', error);
    return failure(translateError(error), values);
  }

  redirect(target);
}
