/**
 * Roles y permisos de la herramienta.
 * - viewer: solo consulta el avance
 * - creator: además crea OVAs
 * - admin: además gestiona el catálogo (escuelas, desarrolladores) y los usuarios
 */
export const ROLES = ['viewer', 'creator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'ova:view'
  | 'ova:create'
  | 'ova:edit'
  | 'catalog:manage'
  | 'users:manage';

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ['ova:view'],
  creator: ['ova:view', 'ova:create', 'ova:edit'],
  admin: ['ova:view', 'ova:create', 'ova:edit', 'catalog:manage', 'users:manage'],
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}
