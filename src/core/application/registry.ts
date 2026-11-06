import type { OvaStatus } from '../domain/OvaStatus';

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
  /** Usuario de GitHub de esta persona (minúsculas); null si aún no se ha vinculado */
  githubLogin: string | null;
}

export interface OvaRecord {
  id: number;
  repoName: string;
  repoUrl: string;
  school: SchoolRecord;
  developer: DeveloperRecord;
  status: OvaStatus;
  /** Cuándo pasó al estado actual. ISO 8601, UTC */
  statusChangedAt: string;
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
  /** Por defecto, "en desarrollo" */
  status?: OvaStatus;
}

export interface OvaChanges {
  schoolId?: number;
  developerId?: number;
  status?: OvaStatus;
}

export interface OvaFilter {
  schoolId?: number;
  developerId?: number;
  status?: OvaStatus;
}

export interface OvaStats {
  total: number;
  bySchool: { school: SchoolRecord; count: number }[];
  byDeveloper: { developer: DeveloperRecord; count: number }[];
  /** Siempre trae los tres estados, aunque alguno tenga 0 */
  byStatus: { status: OvaStatus; count: number }[];
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
  addDeveloper(developer: { name: string; githubLogin?: string | null }): Promise<DeveloperRecord>;
  listDevelopers(): Promise<DeveloperRecord[]>;
  findDeveloper(id: number): Promise<DeveloperRecord | null>;
  /** Quién es esta persona en GitHub; null si nadie la tiene vinculada */
  findDeveloperByLogin(login: string): Promise<DeveloperRecord | null>;
  /**
   * Vincula (o desvincula, con null) el usuario de GitHub de un desarrollador.
   * Lanza DuplicateEntryError si otro desarrollador ya lo tiene. Devuelve null si no existe.
   */
  setDeveloperLogin(id: number, githubLogin: string | null): Promise<DeveloperRecord | null>;
}
