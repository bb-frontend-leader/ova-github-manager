import {
  RepositoryName,
  RepositoryDescription,
  RepositoryTopics,
  TeamPermission,
  type PermissionLevel,
} from '../domain';
import type { RepositoryGateway } from './ports';
import type { CreateRepositoryDTO, CreateRepositoryResult } from './dtos';

export interface CreateRepositoryUseCaseConfig {
  /** Organización por defecto cuando el DTO no indica una */
  org: string;
  /** Texto fijo de la descripción del repo, p. ej. "625 OVAs 2027" */
  descriptionPrefix: string;
  /** Team que se asigna a todo repo nuevo cuando el DTO no indica otro (p. ej. Frontend con pull) */
  defaultTeam?: { slug: string; permission: PermissionLevel };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export class CreateRepositoryUseCase {
  constructor(
    private readonly gateway: RepositoryGateway,
    private readonly config: CreateRepositoryUseCaseConfig,
  ) {}

  async execute(dto: CreateRepositoryDTO): Promise<CreateRepositoryResult> {
    const organization = dto.organization || this.config.org;

    let name: RepositoryName;
    try {
      name = RepositoryName.create(dto.rawName);
    } catch (error) {
      return this.failure('', errorMessage(error, 'Invalid repository name'));
    }
    const repoName = name.getValue();

    let description: RepositoryDescription;
    try {
      description = RepositoryDescription.create(this.config.descriptionPrefix, repoName);
    } catch (error) {
      return this.failure(repoName, errorMessage(error, 'Invalid description'));
    }

    // El team del DTO tiene prioridad; si no hay, se usa el team por defecto de la configuración.
    let team: { slug: string; permission: PermissionLevel } | undefined;
    try {
      if (dto.teamSlug) {
        const permission = TeamPermission.create(dto.teamPermission ?? 'push').getLevel();
        team = { slug: dto.teamSlug, permission };
      } else if (this.config.defaultTeam) {
        const { slug, permission } = this.config.defaultTeam;
        team = { slug, permission: TeamPermission.create(permission).getLevel() };
      }
    } catch (error) {
      return this.failure(repoName, errorMessage(error, 'Invalid team or permission'));
    }

    let topics: RepositoryTopics;
    try {
      topics = RepositoryTopics.create(dto.topics ?? []);
    } catch (error) {
      return this.failure(repoName, errorMessage(error, 'Invalid topics'));
    }

    let created;
    try {
      created = await this.gateway.createRepository({
        org: organization,
        name: repoName,
        description: description.getValue(),
        private: true,
        template: dto.template,
      });
    } catch (error) {
      return this.failure(repoName, errorMessage(error, 'Failed to create repository'));
    }

    // El repositorio ya existe: los pasos siguientes no deben ocultarse si fallan.
    const warnings: string[] = [];

    if (team) {
      try {
        await this.gateway.assignTeam(organization, created.name, team.slug, team.permission);
      } catch (error) {
        warnings.push(
          `No se pudo asignar el team "${team.slug}": ${errorMessage(error, 'error desconocido')}`,
        );
      }
    }

    if (!topics.isEmpty()) {
      try {
        await this.gateway.replaceTopics(organization, created.name, topics.getTopics());
      } catch (error) {
        warnings.push(
          `No se pudieron asignar los topics: ${errorMessage(error, 'error desconocido')}`,
        );
      }
    }

    return {
      success: true,
      repositoryName: created.name,
      repositoryUrl: created.url,
      message:
        warnings.length === 0
          ? `Repository created successfully: ${created.url}`
          : `Repository created with ${warnings.length} warning(s): ${created.url}`,
      warnings,
    };
  }

  private failure(repositoryName: string, message: string): CreateRepositoryResult {
    return { success: false, repositoryName, repositoryUrl: '', message, warnings: [] };
  }
}
