import { Octokit } from '@octokit/rest';
import type {
  RepositoryGateway,
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
export class OctokitRepositoryGateway implements RepositoryGateway {
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

  private mapRepositoryData(data: {
    id: number;
    name: string;
    description: string | null;
    private: boolean;
    html_url: string;
    owner: { login: string };
  }): RepositoryData {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      private: data.private,
      url: data.html_url,
      owner: { login: data.owner.login },
    };
  }
}
