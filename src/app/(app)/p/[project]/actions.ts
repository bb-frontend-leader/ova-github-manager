'use server';

import { redirect } from 'next/navigation';
import { markSynced } from '@/lib/auto-sync';
import { authorizeProjectAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';

/**
 * Concilia el registro con GitHub: quita las OVAs cuyo repositorio ya no existe.
 * `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
export async function syncOvasAction(formData: FormData) {
  const slug = String(formData.get('project') ?? '');
  const base = `/p/${encodeURIComponent(slug)}`;

  const authz = await authorizeProjectAction(slug, 'ova:create');
  if (!authz.ok) redirect(`${base}?syncError=${encodeURIComponent(authz.message)}`);
  const { project, login, services } = authz.value;

  let target: string;
  try {
    const { checked, removed } = await services.syncOvas.execute(login);
    markSynced(project.id);
    const names = removed.map((ova) => ova.repoName).join(',');
    target = `${base}?synced=${checked}&removed=${encodeURIComponent(names.slice(0, 500))}&count=${removed.length}`;
  } catch (error) {
    console.error('[syncOvasAction]', error);
    target = `${base}?syncError=${encodeURIComponent(translateError(error))}`;
  }

  redirect(target);
}
