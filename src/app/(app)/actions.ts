'use server';

import { redirect } from 'next/navigation';
import { markSynced } from '@/lib/auto-sync';
import { authorizeAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';
import { getServices } from '@/lib/services';

/**
 * Concilia el registro con GitHub: quita las OVAs cuyo repositorio ya no existe.
 * `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
export async function syncOvasAction() {
  const authz = await authorizeAction('ova:create');
  if (!authz.ok) redirect(`/?syncError=${encodeURIComponent(authz.message)}`);

  let target: string;
  try {
    const { checked, removed } = await getServices().syncOvas.execute(authz.user.login);
    markSynced();
    const names = removed.map((ova) => ova.repoName).join(',');
    target = `/?synced=${checked}&removed=${encodeURIComponent(names.slice(0, 500))}&count=${removed.length}`;
  } catch (error) {
    console.error('[syncOvasAction]', error);
    target = `/?syncError=${encodeURIComponent(translateError(error))}`;
  }

  redirect(target);
}
