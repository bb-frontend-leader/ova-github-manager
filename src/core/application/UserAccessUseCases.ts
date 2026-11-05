import { GithubLogin } from '../domain/GithubLogin';
import { isRole, type Role } from '../domain/Role';
import { DuplicateEntryError } from './errors';
import type { UserRecord, UserStore } from './users';

export interface SignInConfig {
  /**
   * Usuarios que siempre son admin (se leen de la configuración, no de la base de datos).
   * Sirven de arranque y de recuperación: si se pierde el acceso de admin, basta con
   * añadir un usuario aquí y volver a iniciar sesión.
   */
  initialAdmins: string[];
}

/**
 * Resuelve el usuario que acaba de autenticarse con GitHub.
 * Quien no existe se crea con el mínimo privilegio (viewer), salvo los admins iniciales.
 */
export class SignInUseCase {
  private readonly initialAdmins: Set<string>;

  constructor(
    private readonly users: UserStore,
    config: SignInConfig,
  ) {
    this.initialAdmins = new Set(config.initialAdmins.map((l) => GithubLogin.create(l).getValue()));
  }

  async execute(rawLogin: string): Promise<UserRecord> {
    const login = GithubLogin.create(rawLogin).getValue();
    const isInitialAdmin = this.initialAdmins.has(login);

    const existing = await this.users.findUser(login);

    if (!existing) {
      return this.users.createUser(login, isInitialAdmin ? 'admin' : 'viewer');
    }

    if (isInitialAdmin && existing.role !== 'admin') {
      return (await this.users.setUserRole(login, 'admin')) ?? existing;
    }

    return existing;
  }
}

/** Gestión de usuarios y roles. Quien lo invoca debe haber comprobado el permiso `users:manage`. */
export class ManageUsersUseCase {
  constructor(private readonly users: UserStore) {}

  list(): Promise<UserRecord[]> {
    return this.users.listUsers();
  }

  /** Autoriza de antemano a alguien que aún no ha entrado. */
  async addUser(rawLogin: string, role: Role): Promise<UserRecord> {
    const login = GithubLogin.create(rawLogin).getValue();
    this.assertRole(role);

    if (await this.users.findUser(login)) {
      throw new DuplicateEntryError(`User already exists: ${login}`);
    }
    return this.users.createUser(login, role);
  }

  async changeRole(rawLogin: string, role: Role): Promise<UserRecord> {
    const login = GithubLogin.create(rawLogin).getValue();
    this.assertRole(role);

    const target = await this.users.findUser(login);
    if (!target) {
      throw new Error(`User not found: ${login}`);
    }

    // Nunca puede quedar el sistema sin ningún admin
    if (target.role === 'admin' && role !== 'admin' && (await this.users.countUsersByRole('admin')) <= 1) {
      throw new Error('Cannot remove the last admin');
    }

    return (await this.users.setUserRole(login, role)) ?? target;
  }

  private assertRole(role: Role): void {
    if (!isRole(role)) {
      throw new Error(`Invalid role: ${String(role)}`);
    }
  }
}
