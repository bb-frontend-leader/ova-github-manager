import type { UpdateOvaInput, UpdateOvaResult } from './UpdateOvaUseCase';
import type { Catalog, DeveloperRecord, OvaRecord } from './registry';

/** Tope por operación: cada OVA es una escritura y una anotación en la actividad. */
export const MAX_REASSIGN = 200;

export interface ReassignInput {
  ovaIds: number[];
  /** Desarrollador que recibe las OVAs */
  developerId: number;
  /** Quién lo hace (usuario de GitHub) */
  actor: string;
}

export interface ReassignResult {
  developer: DeveloperRecord;
  /** Cambiaron de desarrollador */
  moved: OvaRecord[];
  /** Ya eran de ese desarrollador */
  unchanged: OvaRecord[];
  /** No se pudieron cambiar (p. ej. la OVA ya no existe), con el motivo */
  failed: { ovaId: number; message: string }[];
  /** Avisos de lo que se guardó pero no se pudo anotar en la actividad */
  warnings: number;
}

/**
 * Pasa varias OVAs a otro desarrollador de una vez. Solo toca el registro (GitHub no sabe quién
 * las lleva). Cada OVA se cambia por separado y queda anotada en la actividad; si alguna falla,
 * las demás se cambian igual y el resultado dice cuáles no.
 */
export class ReassignOvasUseCase {
  constructor(
    private readonly update: { execute(input: UpdateOvaInput): Promise<UpdateOvaResult> },
    private readonly catalog: Pick<Catalog, 'findDeveloper'>,
  ) {}

  async execute(input: ReassignInput): Promise<ReassignResult> {
    const ids = [...new Set(input.ovaIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (ids.length === 0) throw new Error('No OVAs selected');
    if (ids.length > MAX_REASSIGN) throw new Error(`Too many OVAs selected: max ${MAX_REASSIGN}`);

    // Antes de tocar nada: si el destino no existe, no se cambia ninguna
    const developer = await this.catalog.findDeveloper(input.developerId);
    if (!developer) throw new Error('School or developer does not exist');

    const result: ReassignResult = { developer, moved: [], unchanged: [], failed: [], warnings: 0 };
    for (const ovaId of ids) {
      const outcome = await this.update.execute({ ovaId, developerId: developer.id, actor: input.actor });
      if (!outcome.success) {
        result.failed.push({ ovaId, message: outcome.message });
        continue;
      }
      (outcome.changes.length > 0 ? result.moved : result.unchanged).push(outcome.ova);
      result.warnings += outcome.warnings.length;
    }
    return result;
  }
}
