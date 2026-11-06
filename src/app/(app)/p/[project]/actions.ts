'use server';

import { redirect } from 'next/navigation';
import { markSynced } from '@/lib/auto-sync';
import { authorizeProjectAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';
import { STATUS_LABELS, isOvaStatus } from '@/lib/ova-status';

/**
 * Página a la que volver tras una acción: solo rutas de este mismo proyecto (nunca una URL
 * externa), conservando sus filtros. Reemplaza el resultado anterior por el nuevo.
 */
function returnUrl(slug: string, returnTo: string, result: { ok?: string; error?: string }): string {
  const base = `/p/${encodeURIComponent(slug)}`;
  let url: URL;
  try {
    url = new URL(returnTo, 'http://local');
  } catch {
    url = new URL(base, 'http://local');
  }
  const inProject = url.origin === 'http://local' && (url.pathname === base || url.pathname.startsWith(`${base}/`));
  if (!inProject) url = new URL(base, 'http://local');
  url.searchParams.delete('ok');
  url.searchParams.delete('error');
  if (result.ok) url.searchParams.set('ok', result.ok);
  if (result.error) url.searchParams.set('error', result.error);
  return `${url.pathname}${url.search}`;
}

/**
 * Mueve una OVA a otro estado (desde el tablero o desde "Mi trabajo") y vuelve a la página de origen.
 * `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
export async function changeStatusAction(formData: FormData) {
  const slug = String(formData.get('project') ?? '');
  const returnTo = String(formData.get('returnTo') ?? '');
  const id = Number(formData.get('id'));
  const status = String(formData.get('status') ?? '');

  const authz = await authorizeProjectAction(slug, 'ova:edit');
  if (!authz.ok) redirect(returnUrl(slug, returnTo, { error: authz.message }));
  if (!Number.isInteger(id) || id <= 0 || !isOvaStatus(status)) {
    redirect(returnUrl(slug, returnTo, { error: translateError('Invalid OVA status') }));
  }
  const { login, services } = authz.value;

  let result: { ok?: string; error?: string };
  try {
    const outcome = await services.changeStatus.execute({ ovaId: id, status, actor: login });
    result = outcome.success
      ? {
          ok: outcome.changed
            ? `${outcome.ova.repoName} pasó a "${STATUS_LABELS[outcome.ova.status]}".`
            : `${outcome.ova.repoName} ya estaba en "${STATUS_LABELS[outcome.ova.status]}".`,
        }
      : { error: translateError(outcome.message) };
  } catch (error) {
    console.error('[changeStatusAction]', error);
    result = { error: translateError(error) };
  }

  redirect(returnUrl(slug, returnTo, result));
}

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
