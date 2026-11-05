import { RepositoryName } from '../domain';
import { CreateRepositoryUseCase } from './CreateRepositoryUseCase';
import type { CreateRepositoryResult } from './dtos';
import type { AuditLog } from './audit';
import type { SyncOvasUseCase } from './SyncOvasUseCase';
import type { Catalog, OvaRecord, OvaRegistry } from './registry';

export interface CreateOvaInput {
  rawName: string;
  schoolId: number;
  developerId: number;
  /** Quién ejecuta la acción (p. ej. usuario de GitHub), para el registro */
  createdBy: string;
}

export interface CreateOvaResult extends CreateRepositoryResult {
  /** Presente solo si la OVA quedó registrada */
  ova?: OvaRecord;
}

export interface CreateOvaUseCaseConfig {
  /** Topic común a todas las OVAs del proyecto, p. ej. "ovas-2027" */
  projectTopic?: string;
  /**
   * Repositorio plantilla desde el que se crea cada OVA, p. ej. "ova-template"
   * (o "owner/repo"). Debe estar marcado como template en GitHub.
   */
  template?: string;
}

/**
 * Crea la OVA en GitHub (con la escuela como topic) y la anota en el registro.
 * Detecta duplicados antes de llamar a GitHub.
 */
export class CreateOvaUseCase {
  constructor(
    private readonly createRepository: CreateRepositoryUseCase,
    private readonly registry: OvaRegistry,
    private readonly catalog: Catalog,
    private readonly config: CreateOvaUseCaseConfig = {},
    /** Si se indica, un registro cuyo repositorio ya no existe en GitHub no bloquea la creación */
    private readonly sync?: Pick<SyncOvasUseCase, 'removeIfMissing'>,
    /** Si se indica, anota la creación en el registro de actividad */
    private readonly audit?: AuditLog,
  ) {}

  async execute(input: CreateOvaInput): Promise<CreateOvaResult> {
    let repoName: string;
    try {
      repoName = RepositoryName.create(input.rawName).getValue();
    } catch (error) {
      return this.failure('', error instanceof Error ? error.message : 'Invalid repository name');
    }

    const existing = await this.registry.findByRepoName(repoName);
    // Un registro huérfano (repo borrado en GitHub) se limpia y no impide volver a crear la OVA
    const stale = existing ? await this.isStale(repoName, input.createdBy) : false;
    if (existing && !stale) {
      return this.failure(
        repoName,
        `La OVA ${repoName} ya está registrada (escuela: ${existing.school.name}, desarrollador: ${existing.developer.name})`,
      );
    }

    const school = await this.catalog.findSchool(input.schoolId);
    if (!school) {
      return this.failure(repoName, 'La escuela seleccionada no existe');
    }

    const developer = await this.catalog.findDeveloper(input.developerId);
    if (!developer) {
      return this.failure(repoName, 'El desarrollador seleccionado no existe');
    }

    const topics = [this.config.projectTopic, school.slug].filter(
      (topic): topic is string => Boolean(topic),
    );

    const created = await this.createRepository.execute({
      rawName: repoName,
      topics,
      template: this.config.template,
    });
    if (!created.success) {
      return created;
    }

    // El repo ya existe en GitHub: si el registro falla hay que avisarlo, no ocultarlo.
    try {
      const ova = await this.registry.add({
        repoName: created.repositoryName,
        repoUrl: created.repositoryUrl,
        schoolId: school.id,
        developerId: developer.id,
        createdBy: input.createdBy,
      });
      const warnings = [...created.warnings, ...(await this.recordCreation(input, ova))];
      return { ...created, warnings, ova };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'error desconocido';
      const warnings = [
        ...created.warnings,
        `El repositorio se creó en GitHub pero no se pudo registrar: ${reason}`,
      ];
      return {
        ...created,
        warnings,
        message: `Repository created with ${warnings.length} warning(s): ${created.repositoryUrl}`,
      };
    }
  }

  /** Anota la creación; si falla, la OVA ya existe, así que solo se avisa. */
  private async recordCreation(input: CreateOvaInput, ova: OvaRecord): Promise<string[]> {
    if (!this.audit) return [];
    try {
      await this.audit.record({
        actor: input.createdBy,
        action: 'ova.created',
        repoName: ova.repoName,
        repoUrl: ova.repoUrl,
        details: { school: ova.school.name, developer: ova.developer.name },
      });
      return [];
    } catch {
      return ['La OVA se creó, pero no se pudo anotar en el registro de actividad.'];
    }
  }

  private async isStale(repoName: string, actor: string): Promise<boolean> {
    if (!this.sync) return false;
    try {
      return await this.sync.removeIfMissing(repoName, actor);
    } catch {
      return false; // sin poder comprobarlo, se mantiene el bloqueo
    }
  }

  private failure(repositoryName: string, message: string): CreateOvaResult {
    return { success: false, repositoryName, repositoryUrl: '', message, warnings: [] };
  }
}
