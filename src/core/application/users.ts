import type { Role } from '../domain/Role';

export interface UserRecord {
  /** Usuario de GitHub en minúsculas */
  login: string;
  role: Role;
  /**
   * Si su pertenencia a la organización del proyecto se comprobó al iniciar sesión.
   * Un usuario autorizado de antemano no está verificado hasta que entra por primera vez.
   */
  verified: boolean;
  /** ISO 8601, UTC */
  createdAt: string;
}

/** Puerto de persistencia de los usuarios de UN proyecto y su rol en él. */
export interface UserStore {
  findUser(login: string): Promise<UserRecord | null>;
  /** Lanza DuplicateEntryError si el usuario ya existe en el proyecto */
  createUser(login: string, role: Role): Promise<UserRecord>;
  /** Devuelve null si el usuario no existe */
  setUserRole(login: string, role: Role): Promise<UserRecord | null>;
  listUsers(): Promise<UserRecord[]>;
  countUsersByRole(role: Role): Promise<number>;
}
