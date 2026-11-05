/**
 * Registro de actividad: quién hizo qué con cada OVA y cuándo.
 * Cada entrada guarda una copia de los datos de la OVA, porque después puede dejar de existir.
 */

export type AuditAction = 'ova.created' | 'ova.updated' | 'ova.removed';

export interface AuditChange {
  field: 'school' | 'developer';
  from: string;
  to: string;
}

export interface AuditDetails {
  school?: string;
  developer?: string;
  /** Solo en 'ova.updated' */
  changes?: AuditChange[];
  /** Solo en 'ova.removed': por qué se quitó del registro */
  reason?: 'deleted_in_github';
}

export interface NewAuditEntry {
  /** Usuario de GitHub, o "sistema" cuando lo hace la sincronización automática */
  actor: string;
  action: AuditAction;
  repoName: string;
  repoUrl: string;
  details: AuditDetails;
}

export interface AuditEntry extends NewAuditEntry {
  id: number;
  /** ISO 8601, UTC */
  at: string;
}

export interface AuditFilter {
  action?: AuditAction;
  /** Texto contenido en el nombre del repositorio o en el autor */
  search?: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  total: number;
}

export interface AuditLog {
  record(entry: NewAuditEntry): Promise<void>;
  /** Más recientes primero */
  listActivity(filter: AuditFilter, limit: number, offset: number): Promise<AuditPage>;
}

export const SYSTEM_ACTOR = 'sistema';
