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

export type ImportFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; slug: string; attempt: number };

// El archivo de un proyecto grande con todo su historial; el límite de la petición es de 10 MB
const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

/**
 * Crea un proyecto nuevo a partir de un archivo exportado (solo super administradores).
 * Siempre es un proyecto nuevo: no mezcla ni sobrescribe uno existente.
 */
export async function importProjectAction(
  _previous: ImportFormState,
  formData: FormData,
): Promise<ImportFormState> {
  const slug = String(formData.get('slug') ?? '');
  const fail = (message: string): ImportFormState => ({ status: 'error', message, slug, attempt: Date.now() });

  const authz = await authorizeSuperAdminAction();
  if (!authz.ok) return fail(authz.message);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Elige el archivo del proyecto que quieres importar.');
  if (file.size > MAX_IMPORT_BYTES) return fail('El archivo pesa más de 8 MB. Revisa que sea una exportación de proyecto.');

  let target: string;
  try {
    const { project, counts } = await getServices().projectArchive.import(await file.text(), { slug });
    const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
    const summary = `${n(counts.ovas, 'OVA', 'OVAs')}, ${n(counts.schools, 'escuela', 'escuelas')}, ${n(counts.developers, 'desarrollador', 'desarrolladores')} y ${n(counts.members, 'usuario', 'usuarios')}`;
    const query = new URLSearchParams({
      ok: `Proyecto "${project.name}" importado: ${summary}. Cada usuario recupera su acceso al iniciar sesión.`,
    });
    target = `/p/${project.slug}/settings?${query}`;
  } catch (error) {
    console.error('[importProjectAction]', error);
    return fail(translateError(error));
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
