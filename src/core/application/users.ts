import type { Role } from '../domain/Role';

export interface UserRecord {
  /** Usuario de GitHub en minúsculas */
  login: string;
  role: Role;
  /** ISO 8601, UTC */
  createdAt: string;
}

/** Puerto de persistencia de usuarios autorizados y su rol. */
export interface UserStore {
  findUser(login: string): Promise<UserRecord | null>;
  /** Lanza DuplicateEntryError si el usuario ya existe */
  createUser(login: string, role: Role): Promise<UserRecord>;
  /** Devuelve null si el usuario no existe */
  setUserRole(login: string, role: Role): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  countUsersByRole(role: Role): Promise<number>;
}
