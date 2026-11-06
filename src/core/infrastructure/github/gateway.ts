import { Octokit } from '@octokit/rest';
import type {
  RepositoryGateway,
  RepositoryHealth,
  RepositoryInspector,
  RepositoryData,
  CreateRepositoryOptions,
  TeamPermissionLevel,
} from '../../application/ports';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Adaptador de GitHub (Octokit). No contiene reglas de negocio:
 * solo traduce las llamadas del puerto a la API de GitHub.
 */
/** Consulta en bloque (GraphQL): 100 repositorios por llamada, con PRs abiertos y estado del CI. */
const HEALTH_QUERY = `
  query ($org: String!, $cursor: String) {
    organization(login: $org) {
      repositories(first: 100, after: $cursor, orderBy: { field: NAME, direction: ASC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          name
          isArchived
          pushedAt
          pullRequests(states: OPEN) { totalCount }
          defaultBranchRef {
            target { ... on Commit { statusCheckRollup { state } } }
          }
        }
      }
    }
  }
`;

interface HealthResponse {
  organization: {
    repositories: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ({
        name: string;
        isArchived: boolean;
        pushedAt: string | null;
        pullRequests: { totalCount: number };
        defaultBranchRef: { target: { statusCheckRollup?: { state: string } | null } | null } | null;
      } | null)[];
    };
  } | null;
}

/** Tope de páginas (100 repos cada una) para no recorrer organizaciones desmesuradas. */
const MAX_HEALTH_PAGES = 50;

function ciState(state: string | undefined): RepositoryHealth['ci'] {
  if (state === 'SUCCESS') return 'success';
  if (state === 'FAILURE' || state === 'ERROR') return 'failure';
  if (state === 'PENDING' || state === 'EXPECTED') return 'pending';
  return 'none';
}

/** Nivel de acceso a partir de los permisos que informa GitHub (maintain cuenta como push). */
function permissionLevel(permissions?: {
  admin?: boolean;
  maintain?: boolean;
  push?: boolean;
}): TeamPermissionLevel {
  if (permissions?.admin) return 'admin';
  if (permissions?.maintain || permissions?.push) return 'push';
  return 'pull';
}

export class OctokitRepositoryGateway implements RepositoryGateway, RepositoryInspector {
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  /** Comprueba el token y devuelve el login con el que se autenticó. */
  async validateAccess(): Promise<string> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return data.login;
    } catch {
      throw new Error('Failed to authenticate with GitHub. Check your token.');
    }
  }

  async validateOrgAccess(org: string): Promise<void> {
    try {
      await this.octokit.rest.orgs.get({ org });
    } catch {
      throw new Error(`Access denied or organization "${org}" not found.`);
    }
  }

  async createRepository(options: CreateRepositoryOptions): Promise<RepositoryData> {
    const { org, name, description, private: isPrivate, template } = options;

    try {
      if (template) {
        // El template puede ser "owner/repo" o solo "repo" (se asume la organización)
        const [templateOwner, templateRepo] = (
          template.includes('/') ? template : `${org}/${template}`
        ).split('/');

        try {
          const { data } = await this.octokit.rest.repos.createUsingTemplate({
            template_owner: templateOwner,
            template_repo: templateRepo,
            owner: org,
            name,
            description: description || '',
            private: isPrivate,
            include_all_branches: false,
          });
          return this.mapRepositoryData(data);
        } catch (error) {
          // Con plantillas grandes GitHub puede responder 5xx (timeout) aunque SÍ crea el repo.
          // Antes de darlo por fallido se espera a que aparezca.
          const status = (error as { status?: number } | null)?.status;
          if (typeof status === 'number' && status >= 500) {
            const created = await this.waitForRepository(org, name);
            if (created) return created;
          }
          throw error;
        }
      }

      const { data } = await this.octokit.rest.repos.createInOrg({
        org,
        name,
        description: description || '',
        private: isPrivate,
        auto_init: false,
      });
      return this.mapRepositoryData(data);
    } catch (error) {
      throw new Error(`Failed to create repository: ${errorMessage(error)}`);
    }
  }

  async assignTeam(
    org: string,
    repo: string,
    teamSlug: string,
    permission: TeamPermissionLevel,
  ): Promise<void> {
    try {
      await this.octokit.rest.teams.addOrUpdateRepoPermissionsInOrg({
        org,
        team_slug: teamSlug.toLowerCase(),
        owner: org,
        repo,
        permission,
      });
    } catch (error) {
      throw new Error(
        `Failed to assign team "${teamSlug}" to ${org}/${repo}: ${errorMessage(error)}`,
      );
    }
  }

  async replaceTopics(org: string, repo: string, topics: string[]): Promise<void> {
    try {
      await this.octokit.rest.repos.replaceAllTopics({ owner: org, repo, names: topics });
    } catch (error) {
      throw new Error(`Failed to set topics on ${org}/${repo}: ${errorMessage(error)}`);
    }
  }

  async getTopics(org: string, repo: string): Promise<string[]> {
    try {
      const { data } = await this.octokit.rest.repos.getAllTopics({ owner: org, repo });
      return data.names;
    } catch (error) {
      throw new Error(`Failed to read topics of ${org}/${repo}: ${errorMessage(error)}`);
    }
  }

  async getRepository(org: string, repo: string): Promise<RepositoryData> {
    try {
      const { data } = await this.octokit.rest.repos.get({ owner: org, repo });
      return this.mapRepositoryData(data);
    } catch {
      throw new Error(`Repository not found: ${org}/${repo}`);
    }
  }

  async repositoryExists(org: string, repo: string): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({ owner: org, repo });
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && (error as { status?: number }).status === 404) {
        return false;
      }
      throw new Error(`Failed to check repository ${org}/${repo}: ${errorMessage(error)}`);
    }
  }

  async listRepositories(org: string): Promise<RepositoryData[]> {
    try {
      // paginate recorre todas las páginas (con 625+ repos, una sola página de 100 no basta)
      const repos = await this.octokit.paginate(this.octokit.rest.repos.listForOrg, {
        org,
        per_page: 100,
      });
      return repos.map((repo) => this.mapRepositoryData(repo));
    } catch {
      throw new Error(`Failed to list repositories for ${org}`);
    }
  }

  /** Espera (hasta ~45 s) a que un repositorio exista; devuelve null si no aparece. */
  private async waitForRepository(
    org: string,
    repo: string,
    attempts = 15,
    delayMs = 3000,
  ): Promise<RepositoryData | null> {
    for (let attempt = 0; attempt < attempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      try {
        const { data } = await this.octokit.rest.repos.get({ owner: org, repo });
        return this.mapRepositoryData(data);
      } catch {
        // Aún no existe (404) o falló la consulta: se reintenta
      }
    }
    return null;
  }

  async listTeamRepositories(
    org: string,
    teamSlug: string,
  ): Promise<{ name: string; permission: TeamPermissionLevel }[]> {
    try {
      const repos = await this.octokit.paginate(this.octokit.rest.teams.listReposInOrg, {
        org,
        team_slug: teamSlug.toLowerCase(),
        per_page: 100,
      });
      return repos.map((repo) => ({ name: repo.name, permission: permissionLevel(repo.permissions) }));
    } catch (error) {
      throw new Error(`Failed to list repositories of team "${teamSlug}": ${errorMessage(error)}`);
    }
  }

  async getTeamPermission(
    org: string,
    teamSlug: string,
    repo: string,
  ): Promise<TeamPermissionLevel | null> {
    try {
      // Con este formato GitHub devuelve el repositorio con los permisos del team (no un 204 vacío)
      const { data } = await this.octokit.rest.teams.checkPermissionsForRepoInOrg({
        org,
        team_slug: teamSlug.toLowerCase(),
        owner: org,
        repo,
        headers: { accept: 'application/vnd.github.v3.repository+json' },
      });
      return permissionLevel((data as { permissions?: { admin?: boolean; push?: boolean } }).permissions);
    } catch (error) {
      if ((error as { status?: number } | null)?.status === 404) return null;
      throw new Error(`Failed to read team access of ${org}/${repo}: ${errorMessage(error)}`);
    }
  }

  async listRepositoryHealth(org: string): Promise<RepositoryHealth[]> {
    const health: RepositoryHealth[] = [];
    let cursor: string | null = null;
    try {
      for (let page = 0; page < MAX_HEALTH_PAGES; page++) {
        const response: HealthResponse = await this.octokit.graphql<HealthResponse>(HEALTH_QUERY, {
          org,
          cursor,
        });
        if (!response.organization) throw new Error(`Organization not found: ${org}`);
        const { nodes, pageInfo } = response.organization.repositories;
        for (const node of nodes) {
          if (!node) continue;
          health.push({
            name: node.name,
            pushedAt: node.pushedAt,
            openPullRequests: node.pullRequests.totalCount,
            ci: ciState(node.defaultBranchRef?.target?.statusCheckRollup?.state),
            archived: node.isArchived,
          });
        }
        if (!pageInfo.hasNextPage) break;
        cursor = pageInfo.endCursor;
      }
      return health;
    } catch (error) {
      throw new Error(`Failed to read repository health of ${org}: ${errorMessage(error)}`);
    }
  }

  private mapRepositoryData(data: {
    id: number;
    name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    owner: { login: string };
    topics?: string[];
    archived?: boolean;
    is_template?: boolean;
  }): RepositoryData {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      private: data.private,
      url: data.html_url,
      owner: { login: data.owner.login },
      topics: data.topics,
      archived: data.archived,
      isTemplate: data.is_template,
    };
  }
}
