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
}

export type TeamPermissionLevel = 'pull' | 'push' | 'admin';

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
