import { isOvaStatus, type OvaStatus } from '../domain/OvaStatus';
import type { AuditLog } from './audit';
import type { OvaRecord, OvaRegistry } from './registry';

export interface ChangeOvaStatusInput {
  ovaId: number;
  status: string;
  /** Quién hace el cambio (usuario de GitHub) */
  actor: string;
}

export type ChangeOvaStatusResult =
  | { success: true; ova: OvaRecord; changed: boolean; warnings: string[] }
  | { success: false; message: string };

/** Mueve una OVA de estado (en desarrollo → en revisión → entregada, y de vuelta). */
export class ChangeOvaStatusUseCase {
  constructor(
    private readonly registry: OvaRegistry,
    private readonly audit?: AuditLog,
  ) {}

  async execute(input: ChangeOvaStatusInput): Promise<ChangeOvaStatusResult> {
    if (!isOvaStatus(input.status)) return { success: false, message: 'Invalid OVA status' };
    const status: OvaStatus = input.status;

    const current = await this.registry.findById(input.ovaId);
    if (!current) return { success: false, message: 'OVA not found' };
    if (current.status === status) return { success: true, ova: current, changed: false, warnings: [] };

    const updated = await this.registry.update(current.id, { status });
    if (!updated) return { success: false, message: 'OVA not found' };

    const warnings: string[] = [];
    try {
      await this.audit?.record({
        actor: input.actor,
        action: 'ova.status_changed',
        repoName: updated.repoName,
        repoUrl: updated.repoUrl,
        details: {
          school: updated.school.name,
          developer: updated.developer.name,
          changes: [{ field: 'status', from: current.status, to: updated.status }],
        },
      });
    } catch {
      warnings.push('El cambio se guardó, pero no se pudo anotar en el registro de actividad.');
    }
    return { success: true, ova: updated, changed: true, warnings };
  }
}
