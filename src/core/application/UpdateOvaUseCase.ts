import type { AuditChange, AuditLog } from './audit';
import type { RepositoryGateway } from './ports';
import type { Catalog, OvaRecord, OvaRegistry } from './registry';

export interface UpdateOvaInput {
  ovaId: number;
  /** Nueva escuela; si se omite o es la misma, no cambia */
  schoolId?: number;
  /** Nuevo desarrollador; si se omite o es el mismo, no cambia */
  developerId?: number;
  /** Quién hace el cambio (usuario de GitHub) */
  actor: string;
}

export type UpdateOvaResult =
  | { success: true; ova: OvaRecord; changes: AuditChange[]; warnings: string[] }
  | { success: false; message: string };

export interface UpdateOvaConfig {
  org: string;
}

/**
 * Corrige la escuela y/o el desarrollador de una OVA.
 * Cambiar la escuela también cambia su topic en GitHub (se respetan los demás topics).
 * GitHub se actualiza primero: si falla, el registro no cambia y no queda desfasado.
 */
export class UpdateOvaUseCase {
  constructor(
    private readonly gateway: RepositoryGateway,
    private readonly registry: OvaRegistry,
    private readonly catalog: Catalog,
    private readonly config: UpdateOvaConfig,
    private readonly audit?: AuditLog,
  ) {}

  async execute(input: UpdateOvaInput): Promise<UpdateOvaResult> {
    const current = await this.registry.findById(input.ovaId);
    if (!current) return { success: false, message: 'OVA not found' };

    const changes: AuditChange[] = [];

    let newSchool = current.school;
    if (input.schoolId !== undefined && input.schoolId !== current.school.id) {
      const found = await this.catalog.findSchool(input.schoolId);
      if (!found) return { success: false, message: 'School or developer does not exist' };
      newSchool = found;
      changes.push({ field: 'school', from: current.school.name, to: found.name });
    }

    let newDeveloper = current.developer;
    if (input.developerId !== undefined && input.developerId !== current.developer.id) {
      const found = await this.catalog.findDeveloper(input.developerId);
      if (!found) return { success: false, message: 'School or developer does not exist' };
      newDeveloper = found;
      changes.push({ field: 'developer', from: current.developer.name, to: found.name });
    }

    if (changes.length === 0) return { success: true, ova: current, changes, warnings: [] };

    if (newSchool.id !== current.school.id) {
      try {
        const topics = await this.gateway.getTopics(this.config.org, current.repoName);
        const next = [...topics.filter((topic) => topic !== current.school.slug), newSchool.slug];
        await this.gateway.replaceTopics(this.config.org, current.repoName, [...new Set(next)]);
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Failed to set topics',
        };
      }
    }

    const updated = await this.registry.update(current.id, {
      schoolId: newSchool.id,
      developerId: newDeveloper.id,
    });
    if (!updated) return { success: false, message: 'OVA not found' };

    const warnings: string[] = [];
    try {
      await this.audit?.record({
        actor: input.actor,
        action: 'ova.updated',
        repoName: updated.repoName,
        repoUrl: updated.repoUrl,
        details: { school: updated.school.name, developer: updated.developer.name, changes },
      });
    } catch {
      warnings.push('El cambio se guardó, pero no se pudo anotar en el registro de actividad.');
    }

    return { success: true, ova: updated, changes, warnings };
  }
}
