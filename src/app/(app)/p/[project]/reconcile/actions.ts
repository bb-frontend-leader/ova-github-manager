'use server';

import { redirect } from 'next/navigation';
import { authorizeProjectAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';

function back(slug: string, params: { ok?: string; error?: string; warn?: string }): never {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  redirect(`/p/${encodeURIComponent(slug)}/reconcile${query ? `?${query}` : ''}`);
}

function positiveId(value: FormDataEntryValue | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Corrige una OVA registrada (topic y team que le falten). */
export async function repairOvaAction(formData: FormData) {
  const slug = String(formData.get('project') ?? '');
  const repoName = String(formData.get('repoName') ?? '');

  const authz = await authorizeProjectAction(slug, 'catalog:manage');
  if (!authz.ok) back(slug, { error: authz.message });
  const { login, services } = authz.value;

  let outcome: { ok: string } | { error: string };
  try {
    const result = await services.reconcile.repair(repoName, login);
    if (!result.success) {
      outcome = { error: translateError(result.error) };
    } else if (result.fixed.length === 0) {
      outcome = { ok: `${result.repoName} ya estaba en orden.` };
    } else {
      outcome = { ok: `${result.repoName}: se corrigió ${result.fixed.join(' y ')}.` };
    }
  } catch (error) {
    console.error('[repairOvaAction]', error);
    outcome = { error: translateError(error) };
  }
  back(slug, outcome);
}

/** Corrige por tandas todas las OVAs con problemas. */
export async function repairAllAction(formData: FormData) {
  const slug = String(formData.get('project') ?? '');

  const authz = await authorizeProjectAction(slug, 'catalog:manage');
  if (!authz.ok) back(slug, { error: authz.message });
  const { login, services } = authz.value;

  let params: { ok?: string; error?: string; warn?: string };
  try {
    const { outcomes, remaining } = await services.reconcile.repairAll(login);
    const fixed = outcomes.filter((o) => o.success && o.fixed.length > 0).length;
    const failed = outcomes.filter((o) => !o.success);

    params = {
      ok: `Se corrigieron ${fixed} ${fixed === 1 ? 'OVA' : 'OVAs'}.${
        remaining > 0 ? ` Quedan ${remaining} por corregir: vuelve a pulsar el botón para seguir.` : ''
      }`,
    };
    if (failed.length > 0) {
      params.warn = `No se pudo corregir ${failed.length} ${failed.length === 1 ? 'OVA' : 'OVAs'}: ${failed
        .slice(0, 5)
        .map((o) => `${o.repoName} (${translateError(o.error)})`)
        .join('; ')}`.slice(0, 600);
    }
  } catch (error) {
    console.error('[repairAllAction]', error);
    params = { error: translateError(error) };
  }
  back(slug, params);
}

/** Registra un repositorio que ya existe en GitHub como una OVA. */
export async function adoptOvaAction(formData: FormData) {
  const slug = String(formData.get('project') ?? '');
  const repoName = String(formData.get('repoName') ?? '');

  const authz = await authorizeProjectAction(slug, 'catalog:manage');
  if (!authz.ok) back(slug, { error: authz.message });
  const { login, services } = authz.value;

  const schoolId = positiveId(formData.get('schoolId'));
  const developerId = positiveId(formData.get('developerId'));
  if (!schoolId) back(slug, { error: `Elige la escuela de ${repoName}.` });
  if (!developerId) back(slug, { error: `Elige el desarrollador de ${repoName}.` });

  let params: { ok?: string; error?: string; warn?: string };
  try {
    const result = await services.reconcile.adopt({ repoName, schoolId, developerId, actor: login });
    if (!result.success) {
      params = { error: translateError(result.message) };
    } else {
      const fixed = result.fixed.length > 0 ? ` Se corrigió ${result.fixed.join(' y ')}.` : '';
      params = { ok: `${result.ova.repoName} quedó registrada.${fixed}` };
      if (result.warnings.length > 0) params.warn = result.warnings.join(' ').slice(0, 600);
    }
  } catch (error) {
    console.error('[adoptOvaAction]', error);
    params = { error: translateError(error) };
  }
  back(slug, params);
}
