/**
 * Puertos del registro de OVAs y del catálogo (escuelas y desarrolladores).
 * Son asíncronos para poder cambiar de motor de base de datos sin tocar los casos de uso.
 */

export interface SchoolRecord {
  id: number;
  name: string;
  /** Se usa como topic del repositorio en GitHub */
  slug: string;
}

export interface DeveloperRecord {
  id: number;
  name: string;
}

export interface OvaRecord {
  id: number;
  repoName: string;
  repoUrl: string;
  school: SchoolRecord;
  developer: DeveloperRecord;
  /** Quién la creó desde la herramienta (p. ej. usuario de GitHub) */
  createdBy: string;
  /** ISO 8601, UTC */
  createdAt: string;
}

export interface NewOva {
  repoName: string;
  repoUrl: string;
  schoolId: number;
  developerId: number;
  createdBy: string;
}

export interface OvaChanges {
  schoolId?: number;
  developerId?: number;
}

export interface OvaFilter {
  schoolId?: number;
  developerId?: number;
}

export interface OvaStats {
  total: number;
  bySchool: { school: SchoolRecord; count: number }[];
  byDeveloper: { developer: DeveloperRecord; count: number }[];
}

export interface OvaRegistry {
  findByRepoName(repoName: string): Promise<OvaRecord | null>;
  findById(id: number): Promise<OvaRecord | null>;
  /** Cambia la escuela y/o el desarrollador. Devuelve null si la OVA no existe */
  update(id: number, changes: OvaChanges): Promise<OvaRecord | null>;
  /** Lanza DuplicateEntryError si el repositorio ya está registrado */
  add(ova: NewOva): Promise<OvaRecord>;
  /** Más recientes primero */
  list(filter?: OvaFilter): Promise<OvaRecord[]>;
  stats(): Promise<OvaStats>;
  /** Quita la OVA del registro. Devuelve false si no existía */
  remove(id: number): Promise<boolean>;
}

export interface Catalog {
  /** Lanza DuplicateEntryError si ya existe (sin distinguir mayúsculas) */
  addSchool(school: { name: string; slug: string }): Promise<SchoolRecord>;
  listSchools(): Promise<SchoolRecord[]>;
  findSchool(id: number): Promise<SchoolRecord | null>;
  /** Lanza DuplicateEntryError si ya existe (sin distinguir mayúsculas) */
  addDeveloper(developer: { name: string }): Promise<DeveloperRecord>;
  listDevelopers(): Promise<DeveloperRecord[]>;
  findDeveloper(id: number): Promise<DeveloperRecord | null>;
}
