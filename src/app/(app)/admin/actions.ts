'use server';

import { redirect } from 'next/navigation';
import { isRole, type Permission, type UserRecord } from '@/core';
import { authorizeAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';
import { getServices } from '@/lib/services';

/**
 * Ejecuta una acción de administración y redirige a /admin con el resultado.
 * `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
async function run(permission: Permission, task: (actor: UserRecord) => Promise<string>) {
  const authz = await authorizeAction(permission);
  if (!authz.ok) redirect(`/admin?error=${encodeURIComponent(authz.message)}`);

  let outcome: { ok: string } | { error: string };
  try {
    outcome = { ok: await task(authz.user) };
  } catch (error) {
    outcome = { error: translateError(error) };
  }

  redirect(
    'ok' in outcome
      ? `/admin?ok=${encodeURIComponent(outcome.ok)}`
      : `/admin?error=${encodeURIComponent(outcome.error)}`,
  );
}

export async function addSchoolAction(formData: FormData) {
  await run('catalog:manage', async () => {
    const school = await getServices().manageCatalog.addSchool(String(formData.get('name') ?? ''));
    return `Escuela "${school.name}" añadida (topic: ${school.slug}).`;
  });
}

export async function addDeveloperAction(formData: FormData) {
  await run('catalog:manage', async () => {
    const developer = await getServices().manageCatalog.addDeveloper(
      String(formData.get('name') ?? ''),
    );
    return `Desarrollador "${developer.name}" añadido.`;
  });
}

export async function addUserAction(formData: FormData) {
  await run('users:manage', async () => {
    const role = String(formData.get('role') ?? '');
    if (!isRole(role)) throw new Error('Invalid role');
    const user = await getServices().manageUsers.addUser(String(formData.get('login') ?? ''), role);
    return `@${user.login} autorizado como ${user.role}.`;
  });
}

export async function changeRoleAction(formData: FormData) {
  await run('users:manage', async () => {
    const role = String(formData.get('role') ?? '');
    if (!isRole(role)) throw new Error('Invalid role');
    const user = await getServices().manageUsers.changeRole(
      String(formData.get('login') ?? ''),
      role,
    );
    return `@${user.login} ahora es ${user.role}.`;
  });
}
