import { Developer, GithubLogin, School } from '../domain';
import type { Catalog, DeveloperRecord, SchoolRecord } from './registry';

/** Alta de escuelas y desarrolladores, validando los datos con el dominio. */
export class ManageCatalogUseCase {
  constructor(private readonly catalog: Catalog) {}

  // `async` garantiza que los errores de validación del dominio rechacen la promesa
  // en lugar de lanzarse de forma síncrona.
  async addSchool(name: string): Promise<SchoolRecord> {
    const school = School.create(name);
    return this.catalog.addSchool({ name: school.getName(), slug: school.getSlug() });
  }

  /** `githubLogin` (opcional) vincula a la persona con su usuario de GitHub para "Mi trabajo". */
  async addDeveloper(name: string, githubLogin?: string): Promise<DeveloperRecord> {
    const developer = Developer.create(name);
    const login = githubLogin?.trim() ? GithubLogin.create(githubLogin).getValue() : null;
    return this.catalog.addDeveloper({ name: developer.getName(), githubLogin: login });
  }

  /** Vincula el usuario de GitHub de un desarrollador; un texto vacío lo desvincula. */
  async linkDeveloper(developerId: number, githubLogin: string): Promise<DeveloperRecord> {
    const login = githubLogin.trim() ? GithubLogin.create(githubLogin).getValue() : null;
    const updated = await this.catalog.setDeveloperLogin(developerId, login);
    if (!updated) throw new Error('School or developer does not exist');
    return updated;
  }

  listSchools(): Promise<SchoolRecord[]> {
    return this.catalog.listSchools();
  }

  listDevelopers(): Promise<DeveloperRecord[]> {
    return this.catalog.listDevelopers();
  }
}
