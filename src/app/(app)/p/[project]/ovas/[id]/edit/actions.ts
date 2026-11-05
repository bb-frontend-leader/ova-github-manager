'use server';

import { redirect } from 'next/navigation';
import { authorizeProjectAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';

function back(slug: string, id: number, params: { ok?: string; error?: string }): never {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  redirect(`/p/${encodeURIComponent(slug)}/ovas/${id}/edit?${query}`);
}

/**
 * Cambia la escuela y/o el desarrollador de una OVA.
 * `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
export async function updateOvaAction(formData: FormData) {
  const slug = String(formData.get('project') ?? '');
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect(`/p/${encodeURIComponent(slug)}`);

  const authz = await authorizeProjectAction(slug, 'ova:edit');
  if (!authz.ok) back(slug, id, { error: authz.message });
  const { login, services } = authz.value;

  const schoolId = Number(formData.get('schoolId'));
  const developerId = Number(formData.get('developerId'));
  if (!Number.isInteger(schoolId) || schoolId <= 0) back(slug, id, { error: 'Selecciona una escuela.' });
  if (!Number.isInteger(developerId) || developerId <= 0) back(slug, id, { error: 'Selecciona un desarrollador.' });

  let outcome: { ok: string } | { error: string };
  try {
    const result = await services.updateOva.execute({
      ovaId: id,
      schoolId,
      developerId,
      actor: login,
    });
    if (!result.success) {
      outcome = { error: translateError(result.message) };
    } else if (result.changes.length === 0) {
      outcome = { ok: 'No había cambios que guardar.' };
    } else {
      const parts = result.changes.map((c) =>
        c.field === 'school' ? `escuela: ${c.from} → ${c.to}` : `desarrollador: ${c.from} → ${c.to}`,
      );
      const warnings = result.warnings.length > 0 ? ` ${result.warnings.join(' ')}` : '';
      outcome = { ok: `Cambios guardados (${parts.join('; ')}).${warnings}` };
    }
  } catch (error) {
    console.error('[updateOvaAction]', error);
    outcome = { error: translateError(error) };
  }

  back(slug, id, outcome);
}
