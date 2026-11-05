import type { ProjectDetails } from '../domain/Project';

/**
 * Puertos de proyectos. Un proyecto es un conjunto de OVAs en una organización de GitHub,
 * con su propio catálogo (escuelas y desarrolladores), usuarios y registro de actividad.
 */

export interface ProjectRecord extends ProjectDetails {
  id: number;
  /** ISO 8601, UTC */
  createdAt: string;
}

/** Lo que se puede cambiar de un proyecto: el identificador y la organización son fijos. */
export type ProjectChanges = Partial<Pick<ProjectDetails, 'name' | 'template' | 'defaultTeam' | 'descriptionPrefix' | 'total'>>;

export interface ProjectStore {
  listProjects(): Promise<ProjectRecord[]>;
  /** Proyectos a los que `login` tiene acceso verificado (miembro de su organización) */
  listProjectsFor(login: string): Promise<ProjectRecord[]>;
  findProject(slug: string): Promise<ProjectRecord | null>;
  findProjectById(id: number): Promise<ProjectRecord | null>;
  /** Lanza DuplicateEntryError si el identificador o la organización ya están en uso */
  createProject(project: ProjectDetails): Promise<ProjectRecord>;
  /** Devuelve null si el proyecto no existe */
  updateProject(id: number, changes: ProjectChanges): Promise<ProjectRecord | null>;
}

/** Registra el resultado de comprobar, al iniciar sesión, la membresía en la organización. */
export interface SignInRecorder {
  /**
   * Si es miembro: crea su acceso con `defaultRole` (si no lo tenía) y lo marca como verificado.
   * Si no: le quita la verificación, pero conserva su rol por si vuelve a ser miembro.
   */
  recordSignIn(projectId: number, login: string, isOrgMember: boolean, defaultRole: 'viewer'): Promise<void>;
}
