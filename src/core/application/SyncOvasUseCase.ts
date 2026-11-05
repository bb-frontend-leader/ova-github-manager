import { SYSTEM_ACTOR, type AuditLog } from './audit';
import type { RepositoryGateway } from './ports';
import type { OvaRecord, OvaRegistry } from './registry';

export interface SyncOvasConfig {
  org: string;
}

export interface SyncOvasResult {
  /** Cuántas OVAs había registradas */
  checked: number;
  /** OVAs quitadas del registro porque su repositorio ya no existe en GitHub */
  removed: OvaRecord[];
}

/**
 * Concilia el registro con GitHub: quita las OVAs cuyo repositorio fue borrado.
 * Es conservador: solo borra si GitHub confirma (404) que el repositorio no existe,
 * y se niega a actuar si el listado llega vacío (token sin acceso, por ejemplo).
 */
export class SyncOvasUseCase {
  constructor(
    private readonly gateway: RepositoryGateway,
    private readonly registry: OvaRegistry,
    private readonly config: SyncOvasConfig,
    private readonly audit?: AuditLog,
  ) {}

  /** `actor`: quién la dispara (usuario de GitHub) o "sistema" si es automática */
  async execute(actor: string = SYSTEM_ACTOR): Promise<SyncOvasResult> {
    const registered = await this.registry.list();
    if (registered.length === 0) return { checked: 0, removed: [] };

    const remote = await this.gateway.listRepositories(this.config.org);
    if (remote.length === 0) {
      throw new Error('GitHub returned no repositories; sync aborted');
    }
    const remoteNames = new Set(remote.map((repo) => repo.name.toLowerCase()));

    const removed: OvaRecord[] = [];
    for (const ova of registered) {
      if (remoteNames.has(ova.repoName.toLowerCase())) continue;
      // No estar en el listado no basta (renombres, permisos): se confirma uno a uno
      if (await this.gateway.repositoryExists(this.config.org, ova.repoName)) continue;
      if (await this.registry.remove(ova.id)) {
        removed.push(ova);
        await this.recordRemoval(ova, actor);
      }
    }

    return { checked: registered.length, removed };
  }

  /** Quita una OVA concreta si su repositorio ya no existe. Devuelve true si la quitó. */
  async removeIfMissing(repoName: string, actor: string = SYSTEM_ACTOR): Promise<boolean> {
    const ova = await this.registry.findByRepoName(repoName);
    if (!ova) return false;
    if (await this.gateway.repositoryExists(this.config.org, ova.repoName)) return false;
    const removed = await this.registry.remove(ova.id);
    if (removed) await this.recordRemoval(ova, actor);
    return removed;
  }

  /** La OVA ya se quitó: si no se puede anotar, no se deshace nada. */
  private async recordRemoval(ova: OvaRecord, actor: string): Promise<void> {
    try {
      await this.audit?.record({
        actor,
        action: 'ova.removed',
        repoName: ova.repoName,
        repoUrl: ova.repoUrl,
        details: {
          school: ova.school.name,
          developer: ova.developer.name,
          reason: 'deleted_in_github',
        },
      });
    } catch {
      // sin historial, pero el registro ya quedó al día
    }
  }
}
