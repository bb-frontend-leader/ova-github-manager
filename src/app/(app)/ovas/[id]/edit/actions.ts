'use server';

import { redirect } from 'next/navigation';
import { authorizeAction } from '@/lib/dal';
import { translateError } from '@/lib/messages';
import { getServices } from '@/lib/services';

function back(id: number, params: { ok?: string; error?: string }): never {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  redirect(`/ovas/${id}/edit?${query}`);
}

/**
 * Cambia la escuela y/o el desarrollador de una OVA.
 * `redirect` lanza una excepción, así que se llama siempre fuera del try/catch.
 */
export async function updateOvaAction(formData: FormData) {
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect('/');

  const authz = await authorizeAction('ova:edit');
  if (!authz.ok) back(id, { error: authz.message });

  const schoolId = Number(formData.get('schoolId'));
  const developerId = Number(formData.get('developerId'));
  if (!Number.isInteger(schoolId) || schoolId <= 0) back(id, { error: 'Selecciona una escuela.' });
  if (!Number.isInteger(developerId) || developerId <= 0) back(id, { error: 'Selecciona un desarrollador.' });

  let outcome: { ok: string } | { error: string };
  try {
    const result = await getServices().updateOva.execute({
      ovaId: id,
      schoolId,
      developerId,
      actor: authz.user.login,
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

  back(id, outcome);
}
