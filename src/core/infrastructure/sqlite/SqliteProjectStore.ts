import type Database from 'better-sqlite3';
import type {
  AuditAction,
  AuditDetails,
  AuditFilter,
  AuditLog,
  AuditPage,
  NewAuditEntry,
} from '../../application/audit';
import { DuplicateEntryError } from '../../application/errors';
import type {
  Catalog,
  DeveloperRecord,
  NewOva,
  OvaChanges,
  OvaFilter,
  OvaRecord,
  OvaRegistry,
  OvaStats,
  SchoolRecord,
} from '../../application/registry';
import type { UserRecord, UserStore } from '../../application/users';
import { isOvaStatus, OVA_STATUSES, type OvaStatus } from '../../domain/OvaStatus';
import type { Role } from '../../domain/Role';

const OVA_SELECT = `
  SELECT o.id, o.repo_name, o.repo_url, o.created_by, o.created_at, o.status,
         COALESCE(o.status_changed_at, o.created_at) AS status_changed_at,
         s.id AS school_id, s.name AS school_name, s.slug AS school_slug,
         d.id AS developer_id, d.name AS developer_name, d.github_login AS developer_login
  FROM ovas o
  JOIN schools s ON s.id = o.school_id
  JOIN developers d ON d.id = o.developer_id
`;

interface OvaRow {
  id: number;
  repo_name: string;
  repo_url: string;
  created_by: string;
  created_at: string;
  status: string;
  status_changed_at: string;
  school_id: number;
  school_name: string;
  school_slug: string;
  developer_id: number;
  developer_name: string;
  developer_login: string | null;
}

interface AuditRow {
  id: number;
  at: string;
  actor: string;
  action: AuditAction;
  repo_name: string;
  repo_url: string;
  details: string;
}

interface MemberRow {
  login: string;
  role: Role;
  created_at: string;
  verified_at: string | null;
}

function parseDetails(raw: string): AuditDetails {
  try {
    return JSON.parse(raw) as AuditDetails;
  } catch {
    return {}; // una fila dañada no debe romper toda la pantalla de actividad
  }
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

const DEVELOPER_SELECT = 'SELECT id, name, github_login AS githubLogin FROM developers';

export function sqliteCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

export function isUniqueViolation(error: unknown): boolean {
  const code = sqliteCode(error);
  return code?.startsWith('SQLITE_CONSTRAINT_UNIQUE') === true || code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
}

/**
 * Catálogo, OVAs, usuarios y actividad de UN proyecto sobre SQLite.
 * Toda consulta lleva el `project_id`: lo de un proyecto nunca se mezcla con lo de otro,
 * y los casos de uso no necesitan saber que existen varios.
 */
export class SqliteProjectStore implements OvaRegistry, Catalog, UserStore, AuditLog {
  constructor(
    private readonly db: Database.Database,
    readonly projectId: number,
  ) {}

  /** Cierra la conexión a la base de datos (compartida con el resto de proyectos). */
  close(): void {
    this.db.close();
  }

  // ---- Catálogo ----

  async addSchool(school: { name: string; slug: string }): Promise<SchoolRecord> {
    try {
      const info = this.db
        .prepare('INSERT INTO schools (project_id, name, slug) VALUES (?, ?, ?)')
        .run(this.projectId, school.name, school.slug);
      return { id: Number(info.lastInsertRowid), name: school.name, slug: school.slug };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateEntryError(`School already exists: ${school.name}`);
      }
      throw error;
    }
  }

  async listSchools(): Promise<SchoolRecord[]> {
    return this.db
      .prepare('SELECT id, name, slug FROM schools WHERE project_id = ? ORDER BY name')
      .all(this.projectId) as SchoolRecord[];
  }

  async findSchool(id: number): Promise<SchoolRecord | null> {
    const row = this.db
      .prepare('SELECT id, name, slug FROM schools WHERE id = ? AND project_id = ?')
      .get(id, this.projectId);
    return (row as SchoolRecord | undefined) ?? null;
  }

  async addDeveloper(developer: {
    name: string;
    githubLogin?: string | null;
  }): Promise<DeveloperRecord> {
    const githubLogin = developer.githubLogin ?? null;
    await this.assertLoginFree(githubLogin);
    try {
      const info = this.db
        .prepare('INSERT INTO developers (project_id, name, github_login) VALUES (?, ?, ?)')
        .run(this.projectId, developer.name, githubLogin);
      return { id: Number(info.lastInsertRowid), name: developer.name, githubLogin };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateEntryError(`Developer already exists: ${developer.name}`);
      }
      throw error;
    }
  }

  async listDevelopers(): Promise<DeveloperRecord[]> {
    return this.db
      .prepare(`${DEVELOPER_SELECT} WHERE project_id = ? ORDER BY name`)
      .all(this.projectId) as DeveloperRecord[];
  }

  async findDeveloper(id: number): Promise<DeveloperRecord | null> {
    const row = this.db
      .prepare(`${DEVELOPER_SELECT} WHERE id = ? AND project_id = ?`)
      .get(id, this.projectId);
    return (row as DeveloperRecord | undefined) ?? null;
  }

  async findDeveloperByLogin(login: string): Promise<DeveloperRecord | null> {
    const row = this.db
      .prepare(`${DEVELOPER_SELECT} WHERE project_id = ? AND github_login = ?`)
      .get(this.projectId, login);
    return (row as DeveloperRecord | undefined) ?? null;
  }

  async setDeveloperLogin(id: number, githubLogin: string | null): Promise<DeveloperRecord | null> {
    const current = await this.findDeveloper(id);
    if (!current) return null;
    // Vincularlo de nuevo a la misma persona no es un conflicto
    if (githubLogin !== null && githubLogin !== current.githubLogin) {
      await this.assertLoginFree(githubLogin);
    }
    this.db
      .prepare('UPDATE developers SET github_login = ? WHERE id = ? AND project_id = ?')
      .run(githubLogin, id, this.projectId);
    return this.findDeveloper(id);
  }

  // ---- Usuarios y roles ----

  async findUser(login: string): Promise<UserRecord | null> {
    const row = this.db
      .prepare(
        'SELECT login, role, created_at, verified_at FROM members WHERE project_id = ? AND login = ?',
      )
      .get(this.projectId, login) as MemberRow | undefined;
    return row ? this.mapUser(row) : null;
  }

  async createUser(login: string, role: Role): Promise<UserRecord> {
    try {
      this.db
        .prepare('INSERT INTO members (project_id, login, role) VALUES (?, ?, ?)')
        .run(this.projectId, login, role);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateEntryError(`User already exists: ${login}`);
      }
      throw error;
    }
    return (await this.findUser(login)) as UserRecord;
  }

  async setUserRole(login: string, role: Role): Promise<UserRecord | null> {
    this.db
      .prepare('UPDATE members SET role = ? WHERE project_id = ? AND login = ?')
      .run(role, this.projectId, login);
    return this.findUser(login);
  }

  async listUsers(): Promise<UserRecord[]> {
    const rows = this.db
      .prepare(
        'SELECT login, role, created_at, verified_at FROM members WHERE project_id = ? ORDER BY login',
      )
      .all(this.projectId) as MemberRow[];
    return rows.map((row) => this.mapUser(row));
  }

  async countUsersByRole(role: Role): Promise<number> {
    const { count } = this.db
      .prepare('SELECT COUNT(*) AS count FROM members WHERE project_id = ? AND role = ?')
      .get(this.projectId, role) as { count: number };
    return count;
  }

  // ---- Registro de OVAs ----

  async findByRepoName(repoName: string): Promise<OvaRecord | null> {
    const row = this.db
      .prepare(`${OVA_SELECT} WHERE o.project_id = ? AND o.repo_name = ?`)
      .get(this.projectId, repoName) as OvaRow | undefined;
    return row ? this.mapOva(row) : null;
  }

  async findById(id: number): Promise<OvaRecord | null> {
    const row = this.db
      .prepare(`${OVA_SELECT} WHERE o.project_id = ? AND o.id = ?`)
      .get(this.projectId, id) as OvaRow | undefined;
    return row ? this.mapOva(row) : null;
  }

  async add(ova: NewOva): Promise<OvaRecord> {
    await this.assertOwnCatalog(ova.schoolId, ova.developerId);

    let id: number;
    try {
      const info = this.db
        .prepare(
          `INSERT INTO ovas (project_id, repo_name, repo_url, school_id, developer_id, created_by, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          this.projectId,
          ova.repoName,
          ova.repoUrl,
          ova.schoolId,
          ova.developerId,
          ova.createdBy,
          ova.status ?? 'development',
        );
      id = Number(info.lastInsertRowid);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateEntryError(`OVA already registered: ${ova.repoName}`);
      }
      throw error;
    }

    return (await this.findById(id)) as OvaRecord;
  }

  async list(filter: OvaFilter = {}): Promise<OvaRecord[]> {
    const conditions = ['o.project_id = ?'];
    const params: (string | number)[] = [this.projectId];

    if (filter.status !== undefined) {
      conditions.push('o.status = ?');
      params.push(filter.status);
    }
    if (filter.schoolId !== undefined) {
      conditions.push('o.school_id = ?');
      params.push(filter.schoolId);
    }
    if (filter.developerId !== undefined) {
      conditions.push('o.developer_id = ?');
      params.push(filter.developerId);
    }

    const rows = this.db
      .prepare(`${OVA_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY o.id DESC`)
      .all(...params) as OvaRow[];
    return rows.map((row) => this.mapOva(row));
  }

  async update(id: number, changes: OvaChanges): Promise<OvaRecord | null> {
    if (!(await this.findById(id))) return null;
    await this.assertOwnCatalog(changes.schoolId, changes.developerId);

    const sets: string[] = [];
    const params: (string | number)[] = [];
    if (changes.status !== undefined) {
      const current = (await this.findById(id)) as OvaRecord;
      // Solo se reinicia el reloj del estado si de verdad cambia
      if (current.status !== changes.status) {
        sets.push('status = ?', `status_changed_at = ${NOW}`);
        params.push(changes.status);
      }
    }
    if (changes.schoolId !== undefined) {
      sets.push('school_id = ?');
      params.push(changes.schoolId);
    }
    if (changes.developerId !== undefined) {
      sets.push('developer_id = ?');
      params.push(changes.developerId);
    }

    if (sets.length > 0) {
      this.db
        .prepare(`UPDATE ovas SET ${sets.join(', ')} WHERE id = ? AND project_id = ?`)
        .run(...params, id, this.projectId);
    }

    return this.findById(id);
  }

  async remove(id: number): Promise<boolean> {
    return (
      this.db.prepare('DELETE FROM ovas WHERE id = ? AND project_id = ?').run(id, this.projectId)
        .changes > 0
    );
  }

  async stats(): Promise<OvaStats> {
    const { total } = this.db
      .prepare('SELECT COUNT(*) AS total FROM ovas WHERE project_id = ?')
      .get(this.projectId) as { total: number };

    const bySchool = (
      this.db
        .prepare(
          `SELECT s.id, s.name, s.slug, COUNT(o.id) AS count
           FROM schools s LEFT JOIN ovas o ON o.school_id = s.id
           WHERE s.project_id = ?
           GROUP BY s.id ORDER BY s.name`,
        )
        .all(this.projectId) as (SchoolRecord & { count: number })[]
    ).map(({ count, ...school }) => ({ school, count }));

    const byDeveloper = (
      this.db
        .prepare(
          `SELECT d.id, d.name, d.github_login AS githubLogin, COUNT(o.id) AS count
           FROM developers d LEFT JOIN ovas o ON o.developer_id = d.id
           WHERE d.project_id = ?
           GROUP BY d.id ORDER BY d.name`,
        )
        .all(this.projectId) as (DeveloperRecord & { count: number })[]
    ).map(({ count, ...developer }) => ({ developer, count }));

    const statusRows = this.db
      .prepare('SELECT status, COUNT(*) AS count FROM ovas WHERE project_id = ? GROUP BY status')
      .all(this.projectId) as { status: string; count: number }[];
    const byStatus = OVA_STATUSES.map((status) => ({
      status,
      count: statusRows.find((row) => row.status === status)?.count ?? 0,
    }));

    return { total, bySchool, byDeveloper, byStatus };
  }

  // ---- Registro de actividad ----

  async record(entry: NewAuditEntry): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO audit_log (project_id, actor, action, repo_name, repo_url, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        this.projectId,
        entry.actor,
        entry.action,
        entry.repoName,
        entry.repoUrl,
        JSON.stringify(entry.details),
      );
  }

  async listActivity(filter: AuditFilter, limit: number, offset: number): Promise<AuditPage> {
    const { action, search } = filter;
    const conditions = ['project_id = ?'];
    const params: (string | number)[] = [this.projectId];
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (search?.trim()) {
      conditions.push("(repo_name LIKE ? ESCAPE '\\' OR actor LIKE ? ESCAPE '\\')");
      const like = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
      params.push(like, like);
    }
    const where = ` WHERE ${conditions.join(' AND ')}`;

    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total FROM audit_log${where}`)
      .get(...params) as { total: number };
    const rows = this.db
      .prepare(`SELECT * FROM audit_log${where} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as AuditRow[];

    return {
      total,
      entries: rows.map((row) => ({
        id: row.id,
        at: row.at,
        actor: row.actor,
        action: row.action,
        repoName: row.repo_name,
        repoUrl: row.repo_url,
        details: parseDetails(row.details),
      })),
    };
  }

  /** Un usuario de GitHub solo puede estar vinculado a un desarrollador del proyecto. */
  private async assertLoginFree(githubLogin: string | null): Promise<void> {
    if (githubLogin !== null && (await this.findDeveloperByLogin(githubLogin))) {
      throw new DuplicateEntryError(`GitHub user already linked: ${githubLogin}`);
    }
  }

  /** La escuela y el desarrollador deben ser de este proyecto, no de otro. */
  private async assertOwnCatalog(schoolId?: number, developerId?: number): Promise<void> {
    if (schoolId !== undefined && !(await this.findSchool(schoolId))) {
      throw new Error('School or developer does not exist');
    }
    if (developerId !== undefined && !(await this.findDeveloper(developerId))) {
      throw new Error('School or developer does not exist');
    }
  }

  private mapUser(row: MemberRow): UserRecord {
    return {
      login: row.login,
      role: row.role,
      verified: row.verified_at !== null,
      createdAt: row.created_at,
    };
  }

  private mapOva(row: OvaRow): OvaRecord {
    return {
      id: row.id,
      repoName: row.repo_name,
      repoUrl: row.repo_url,
      school: { id: row.school_id, name: row.school_name, slug: row.school_slug },
      developer: { id: row.developer_id, name: row.developer_name, githubLogin: row.developer_login },
      status: (isOvaStatus(row.status) ? row.status : 'development') as OvaStatus,
      statusChangedAt: row.status_changed_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
