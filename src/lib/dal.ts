import 'server-only';
import { redirect } from 'next/navigation';
import { can, type Permission, type UserRecord } from '@/core';
import { auth } from '@/auth';
import { getServices } from './services';

/**
 * Capa de acceso a datos (DAL): único lugar donde se decide quién es el usuario y qué puede hacer.
 * Se llama desde cada página y cada acción de servidor, junto a los datos que protege.
 */

/** Usuario autenticado y autorizado. El rol sale de la base de datos, no del token. */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const session = await auth();
  const login = session?.user?.login;
  if (!login) return null;
  return getServices().store.findUser(login);
}

/** Para páginas: sin sesión va al login; sin permiso vuelve al inicio. */
export async function requirePagePermission(permission: Permission): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!can(user.role, permission)) redirect('/?denied=1');
  return user;
}

export type ActionAuth =
  | { ok: true; user: UserRecord }
  | { ok: false; message: string };

/** Para acciones de servidor: devuelve un mensaje en vez de redirigir. */
export async function authorizeAction(permission: Permission): Promise<ActionAuth> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
  if (!can(user.role, permission)) {
    return { ok: false, message: 'No tienes permiso para realizar esta acción.' };
  }
  return { ok: true, user };
}
