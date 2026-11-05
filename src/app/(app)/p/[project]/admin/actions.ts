'use server';

import { redirect } from 'next/navigation';
import { isRole, type Permission } from '@/core';
import { authorizeProjectAction, type ProjectAccess } from '@/lib/dal';
import { translateError } from '@/lib/messages';

/**
 * Ejecuta una acción de administración y redirige a /admin con el resultado.
 * `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
async function run(
  formData: FormData,
  permission: Permission,
  task: (access: ProjectAccess) => Promise<string>,
) {
  const slug = String(formData.get('project') ?? '');
  const admin = `/p/${encodeURIComponent(slug)}/admin`;

  const authz = await authorizeProjectAction(slug, permission);
  if (!authz.ok) redirect(`${admin}?error=${encodeURIComponent(authz.message)}`);

  let outcome: { ok: string } | { error: string };
  try {
    outcome = { ok: await task(authz.value) };
  } catch (error) {
    outcome = { error: translateError(error) };
  }

  redirect(
    'ok' in outcome
      ? `${admin}?ok=${encodeURIComponent(outcome.ok)}`
      : `${admin}?error=${encodeURIComponent(outcome.error)}`,
  );
}

export async function addSchoolAction(formData: FormData) {
  await run(formData, 'catalog:manage', async ({ services }) => {
    const school = await services.manageCatalog.addSchool(String(formData.get('name') ?? ''));
    return `Escuela "${school.name}" añadida (topic: ${school.slug}).`;
  });
}

export async function addDeveloperAction(formData: FormData) {
  await run(formData, 'catalog:manage', async ({ services }) => {
    const developer = await services.manageCatalog.addDeveloper(
      String(formData.get('name') ?? ''),
    );
    return `Desarrollador "${developer.name}" añadido.`;
  });
}

export async function addUserAction(formData: FormData) {
  await run(formData, 'users:manage', async ({ services }) => {
    const role = String(formData.get('role') ?? '');
    if (!isRole(role)) throw new Error('Invalid role');
    const user = await services.manageUsers.addUser(String(formData.get('login') ?? ''), role);
    return `@${user.login} autorizado como ${user.role}.`;
  });
}

export async function changeRoleAction(formData: FormData) {
  await run(formData, 'users:manage', async ({ services }) => {
    const role = String(formData.get('role') ?? '');
    if (!isRole(role)) throw new Error('Invalid role');
    const user = await services.manageUsers.changeRole(
      String(formData.get('login') ?? ''),
      role,
    );
    return `@${user.login} ahora es ${user.role}.`;
  });
}
