import { Project, type ProjectInput } from '../domain/Project';
import type { RepositoryGateway } from './ports';
import type { ProjectChanges, ProjectRecord, ProjectStore } from './projects';

/** Lo que se necesita de GitHub para dar de alta un proyecto. */
export interface ProjectGateway extends Pick<RepositoryGateway, 'repositoryExists'> {
  /** Lanza error si el token no puede ver la organización */
  validateOrgAccess(org: string): Promise<void>;
}

export interface ProjectResult {
  project: ProjectRecord;
  /** Avisos que no impiden guardar (p. ej. la plantilla aún no existe) */
  warnings: string[];
}

/**
 * Alta y edición de proyectos. Solo la persona con acceso de super administrador debe invocarlo.
 * Comprueba con GitHub que la organización es accesible antes de registrarla.
 */
export class ManageProjectsUseCase {
  constructor(
    private readonly projects: ProjectStore,
    private readonly gateway: ProjectGateway,
  ) {}

  list(): Promise<ProjectRecord[]> {
    return this.projects.listProjects();
  }

  async create(input: ProjectInput): Promise<ProjectResult> {
    const details = Project.validate(input);

    await this.gateway.validateOrgAccess(details.org);
    const warnings = await this.templateWarnings(details.org, details.template);

    const project = await this.projects.createProject(details);
    return { project, warnings };
  }

  /** Cambia nombre, plantilla, team, prefijo y total. El identificador y la organización no cambian. */
  async update(
    id: number,
    changes: Required<Pick<ProjectInput, 'name' | 'template' | 'defaultTeam' | 'descriptionPrefix' | 'total'>>,
  ): Promise<ProjectResult> {
    const current = await this.projects.findProjectById(id);
    if (!current) throw new Error('Project not found');

    const details = Project.validate({ ...changes, org: current.org, slug: current.slug });
    const patch: ProjectChanges = {
      name: details.name,
      template: details.template,
      defaultTeam: details.defaultTeam,
      descriptionPrefix: details.descriptionPrefix,
      total: details.total,
    };

    const warnings =
      details.template === current.template ? [] : await this.templateWarnings(current.org, details.template);
    const project = await this.projects.updateProject(id, patch);
    if (!project) throw new Error('Project not found');
    return { project, warnings };
  }

  private async templateWarnings(org: string, template: string): Promise<string[]> {
    // La plantilla puede indicarse como "owner/repo"; si no, se busca en la propia organización
    const [owner, repo] = template.includes('/') ? template.split('/', 2) : [org, template];
    try {
      if (!(await this.gateway.repositoryExists(owner, repo))) {
        return [`La plantilla "${template}" no existe en ${owner}. Créala (marcada como "Template repository") antes de crear OVAs.`];
      }
      return [];
    } catch {
      return [`No se pudo comprobar si la plantilla "${template}" existe en ${owner}.`];
    }
  }
}
