import { GithubLogin } from '../domain/GithubLogin';
import { isRole, type Role } from '../domain/Role';
import { DuplicateEntryError } from './errors';
import type { ProjectRecord, ProjectStore, SignInRecorder } from './projects';
import type { UserRecord, UserStore } from './users';

export interface SignInConfig {
  /**
   * Super administradores: crean proyectos y son admin en todos (se leen de la configuración,
   * no de la base de datos). Sirven de arranque y de recuperación: si se pierde el acceso,
   * basta con añadir un usuario aquí y volver a iniciar sesión.
   */
  superAdmins: string[];
}

export interface SignInResult {
  login: string;
  superAdmin: boolean;
  /** Proyectos a los que puede entrar (todos, si es super administrador) */
  projects: ProjectRecord[];
}

/**
 * Resuelve el acceso de quien acaba de autenticarse con GitHub.
 * Se pertenece a un proyecto si se es miembro activo de su organización; quien entra por
 * primera vez queda con el mínimo privilegio (lector). Los super administradores entran siempre.
 */
export class SignInUseCase {
  private readonly superAdmins: Set<string>;

  constructor(
    private readonly projects: ProjectStore & SignInRecorder,
    config: SignInConfig,
  ) {
    this.superAdmins = new Set(config.superAdmins.map((l) => GithubLogin.create(l).getValue()));
  }

  isSuperAdmin(rawLogin: string): boolean {
    return this.superAdmins.has(GithubLogin.create(rawLogin).getValue());
  }

  /** `isOrgMember` consulta a GitHub (con el token de la persona) si es miembro de una organización. */
  async execute(
    rawLogin: string,
    isOrgMember: (org: string) => Promise<boolean>,
  ): Promise<SignInResult> {
    const login = GithubLogin.create(rawLogin).getValue();
    const superAdmin = this.superAdmins.has(login);
    const all = await this.projects.listProjects();

    const checked = await Promise.all(
      all.map(async (project) => {
        let member = false;
        try {
          member = await isOrgMember(project.org);
        } catch {
          member = false; // sin poder comprobarlo, no se da acceso
        }
        await this.projects.recordSignIn(project.id, login, member, 'viewer');
        return member ? project : null;
      }),
    );

    return {
      login,
      superAdmin,
      projects: superAdmin
        ? all
        : checked.filter((project): project is ProjectRecord => project !== null),
    };
  }
}

/**
 * Gestión de los usuarios y roles de UN proyecto (el almacén ya viene acotado a él).
 * Quien lo invoca debe haber comprobado el permiso `users:manage`.
 */
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

    // Nunca puede quedar un proyecto sin ningún admin
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
