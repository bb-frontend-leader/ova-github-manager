/**
 * Puertos (interfaces) que la capa de aplicación necesita del exterior.
 * La infraestructura los implementa; la lógica de negocio solo depende de esto.
 */
export interface RepositoryData {
  id: number;
  name: string;
  description: string | null;
  private: boolean;
  url: string;
  owner: {
    login: string;
  };
  /** Los trae el listado de la organización; pueden faltar en otras consultas */
  topics?: string[];
  archived?: boolean;
  isTemplate?: boolean;
}

export type TeamPermissionLevel = 'pull' | 'push' | 'admin';

/** Orden de menor a mayor acceso: sirve para saber si un permiso es insuficiente. */
export const TEAM_PERMISSION_RANK: Record<TeamPermissionLevel, number> = {
  pull: 0,
  push: 1,
  admin: 2,
};

/** Cómo va un repositorio: actividad reciente, PRs abiertos y resultado de su CI. */
export interface RepositoryHealth {
  name: string;
  /** Último push a cualquier rama. ISO 8601, UTC; null si el repositorio está vacío */
  pushedAt: string | null;
  openPullRequests: number;
  /** Resultado de los checks del último commit de la rama principal ('none' = no tiene) */
  ci: 'success' | 'failure' | 'pending' | 'none';
  archived: boolean;
}

export interface CreateRepositoryOptions {
  org: string;
  name: string;
  description?: string;
  private: boolean;
  template?: string;
}

export interface RepositoryGateway {
  createRepository(options: CreateRepositoryOptions): Promise<RepositoryData>;
  assignTeam(
    org: string,
    repo: string,
    teamSlug: string,
    permission: TeamPermissionLevel,
  ): Promise<void>;
  replaceTopics(org: string, repo: string, topics: string[]): Promise<void>;
  getTopics(org: string, repo: string): Promise<string[]>;
  getRepository(org: string, repo: string): Promise<RepositoryData>;
  /** false solo si GitHub responde que no existe (404); cualquier otro fallo lanza error */
  repositoryExists(org: string, repo: string): Promise<boolean>;
  listRepositories(org: string): Promise<RepositoryData[]>;
}

/**
 * Consultas de solo lectura para revisar el estado de los repositorios.
 * Va aparte de RepositoryGateway: quien solo crea o sincroniza no necesita conocerlas.
 */
export interface RepositoryInspector {
  /** Repositorios a los que el team tiene acceso y con qué permiso (un solo recorrido, no uno por repo) */
  listTeamRepositories(
    org: string,
    teamSlug: string,
  ): Promise<{ name: string; permission: TeamPermissionLevel }[]>;
  /** Permiso del team sobre un repositorio; null si no tiene acceso */
  getTeamPermission(
    org: string,
    teamSlug: string,
    repo: string,
  ): Promise<TeamPermissionLevel | null>;
  /** Salud de todos los repositorios de la organización */
  listRepositoryHealth(org: string): Promise<RepositoryHealth[]>;
}
