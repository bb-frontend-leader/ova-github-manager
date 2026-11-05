import { Developer, School } from '../domain';
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

  async addDeveloper(name: string): Promise<DeveloperRecord> {
    const developer = Developer.create(name);
    return this.catalog.addDeveloper({ name: developer.getName() });
  }

  listSchools(): Promise<SchoolRecord[]> {
    return this.catalog.listSchools();
  }

  listDevelopers(): Promise<DeveloperRecord[]> {
    return this.catalog.listDevelopers();
  }
}
