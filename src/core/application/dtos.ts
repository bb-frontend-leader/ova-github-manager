import type { TeamPermissionLevel } from './ports';

/**
 * Data Transfer Object para crear un repositorio
 */
export interface CreateRepositoryDTO {
  rawName: string;
  template?: string;
  /** Si se omite, se usa la organización configurada en el caso de uso */
  organization?: string;
  teamSlug?: string;
  /** Si hay teamSlug y no se indica permiso, se usa 'push' */
  teamPermission?: TeamPermissionLevel;
  topics?: string[];
}

/**
 * Resultado de crear un repositorio.
 *
 * `success` significa que el repositorio en sí se creó. Los pasos posteriores
 * (asignar team, poner topics) que fallen se reportan en `warnings`.
 */
export interface CreateRepositoryResult {
  success: boolean;
  repositoryName: string;
  repositoryUrl: string;
  message: string;
  warnings: string[];
}
