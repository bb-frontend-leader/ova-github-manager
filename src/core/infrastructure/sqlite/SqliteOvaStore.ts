import Database from 'better-sqlite3';
import { DuplicateEntryError } from '../../application/errors';
import type {
  AuditAction,
  AuditDetails,
  AuditFilter,
  AuditLog,
  AuditPage,
  NewAuditEntry,
} from '../../application/audit';
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
import type { Role } from '../../domain/Role';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS schools (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    slug TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS developers (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS ovas (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_name    TEXT NOT NULL UNIQUE COLLATE NOCASE,
    repo_url     TEXT NOT NULL,
    school_id    INTEGER NOT NULL REFERENCES schools(id),
    developer_id INTEGER NOT NULL REFERENCES developers(id),
    created_by   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS users (
    login      TEXT PRIMARY KEY COLLATE NOCASE,
    role       TEXT NOT NULL CHECK (role IN ('viewer', 'creator', 'admin')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    actor     TEXT NOT NULL,
    action    TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    repo_url  TEXT NOT NULL,
    details   TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_ovas_school ON ovas(school_id);
  CREATE INDEX IF NOT EXISTS idx_ovas_developer ON ovas(developer_id);
`;

const OVA_SELECT = `
  SELECT o.id, o.repo_name, o.repo_url, o.created_by, o.created_at,
         s.id AS school_id, s.name AS school_name, s.slug AS school_slug,
         d.id AS developer_id, d.name AS developer_name
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
  school_id: number;
  school_name: string;
  school_slug: string;
  developer_id: number;
  developer_name: string;
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

function parseDetails(raw: string): AuditDetails {
  try {
    return JSON.parse(raw) as AuditDetails;
  } catch {
    return {}; // una fila dañada no debe romper toda la pantalla de actividad
  }
}

interface UserRow {
  login: string;
  role: Role;
  created_at: string;
}

function sqliteCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

function isUniqueViolation(error: unknown): boolean {
  return sqliteCode(error)?.startsWith('SQLITE_CONSTRAINT_UNIQUE') ?? false;
}

/**
 * Registro de OVAs y catálogo sobre SQLite.
 * Usa `:memory:` como ruta para pruebas.
 */
export class SqliteOvaStore implements OvaRegistry, Catalog, UserStore, AuditLog {
  private readonly db: Database.Database;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA);
  }

  close(): void {
    this.db.close();
  }

  // ---- Catálogo ----

  async addSchool(school: { name: string; slug: string }): Promise<SchoolRecord> {
    try {
      const info = this.db
        .prepare('INSERT INTO schools (name, slug) VALUES (?, ?)')
        .run(school.name, school.slug);
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
      .prepare('SELECT id, name, slug FROM schools ORDER BY name')
      .all() as SchoolRecord[];
  }

  async findSchool(id: number): Promise<SchoolRecord | null> {
    const row = this.db.prepare('SELECT id, name, slug FROM schools WHERE id = ?').get(id);
    return (row as SchoolRecord | undefined) ?? null;
  }

  async addDeveloper(developer: { name: string }): Promise<DeveloperRecord> {
    try {
      const info = this.db.prepare('INSERT INTO developers (name) VALUES (?)').run(developer.name);
      return { id: Number(info.lastInsertRowid), name: developer.name };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateEntryError(`Developer already exists: ${developer.name}`);
      }
      throw error;
    }
  }

  async listDevelopers(): Promise<DeveloperRecord[]> {
    return this.db
      .prepare('SELECT id, name FROM developers ORDER BY name')
      .all() as DeveloperRecord[];
  }

  async findDeveloper(id: number): Promise<DeveloperRecord | null> {
    const row = this.db.prepare('SELECT id, name FROM developers WHERE id = ?').get(id);
    return (row as DeveloperRecord | undefined) ?? null;
  }

  // ---- Usuarios y roles ----

  async findUser(login: string): Promise<UserRecord | null> {
    const row = this.db
      .prepare('SELECT login, role, created_at FROM users WHERE login = ?')
      .get(login) as UserRow | undefined;
    return row ? this.mapUser(row) : null;
  }

  async createUser(login: string, role: Role): Promise<UserRecord> {
    try {
      this.db.prepare('INSERT INTO users (login, role) VALUES (?, ?)').run(login, role);
    } catch (error) {
      if (isUniqueViolation(error) || sqliteCode(error) === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
        throw new DuplicateEntryError(`User already exists: ${login}`);
      }
      throw error;
    }
    return (await this.findUser(login)) as UserRecord;
  }

  async setUserRole(login: string, role: Role): Promise<UserRecord | null> {
    this.db.prepare('UPDATE users SET role = ? WHERE login = ?').run(role, login);
    return this.findUser(login);
  }

  async listUsers(): Promise<UserRecord[]> {
    const rows = this.db
      .prepare('SELECT login, role, created_at FROM users ORDER BY login')
      .all() as UserRow[];
    return rows.map((row) => this.mapUser(row));
  }

  async countUsersByRole(role: Role): Promise<number> {
    const { count } = this.db
      .prepare('SELECT COUNT(*) AS count FROM users WHERE role = ?')
      .get(role) as { count: number };
    return count;
  }

  // ---- Registro de OVAs ----

  async findByRepoName(repoName: string): Promise<OvaRecord | null> {
    const row = this.db
      .prepare(`${OVA_SELECT} WHERE o.repo_name = ?`)
      .get(repoName) as OvaRow | undefined;
    return row ? this.mapOva(row) : null;
  }

  async add(ova: NewOva): Promise<OvaRecord> {
    let id: number;
    try {
      const info = this.db
        .prepare(
          `INSERT INTO ovas (repo_name, repo_url, school_id, developer_id, created_by)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(ova.repoName, ova.repoUrl, ova.schoolId, ova.developerId, ova.createdBy);
      id = Number(info.lastInsertRowid);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateEntryError(`OVA already registered: ${ova.repoName}`);
      }
      if (sqliteCode(error)?.startsWith('SQLITE_CONSTRAINT_FOREIGNKEY')) {
        throw new Error('School or developer does not exist');
      }
      throw error;
    }

    const row = this.db.prepare(`${OVA_SELECT} WHERE o.id = ?`).get(id) as OvaRow;
    return this.mapOva(row);
  }

  async list(filter: OvaFilter = {}): Promise<OvaRecord[]> {
    const conditions: string[] = [];
    const params: number[] = [];

    if (filter.schoolId !== undefined) {
      conditions.push('o.school_id = ?');
      params.push(filter.schoolId);
    }
    if (filter.developerId !== undefined) {
      conditions.push('o.developer_id = ?');
      params.push(filter.developerId);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`${OVA_SELECT}${where} ORDER BY o.id DESC`)
      .all(...params) as OvaRow[];
    return rows.map((row) => this.mapOva(row));
  }

  async findById(id: number): Promise<OvaRecord | null> {
    const row = this.db.prepare(`${OVA_SELECT} WHERE o.id = ?`).get(id) as OvaRow | undefined;
    return row ? this.mapOva(row) : null;
  }

  async update(id: number, changes: OvaChanges): Promise<OvaRecord | null> {
    const sets: string[] = [];
    const params: number[] = [];
    if (changes.schoolId !== undefined) {
      sets.push('school_id = ?');
      params.push(changes.schoolId);
    }
    if (changes.developerId !== undefined) {
      sets.push('developer_id = ?');
      params.push(changes.developerId);
    }

    if (sets.length > 0) {
      try {
        const info = this.db
          .prepare(`UPDATE ovas SET ${sets.join(', ')} WHERE id = ?`)
          .run(...params, id);
        if (info.changes === 0) return null;
      } catch (error) {
        if (sqliteCode(error)?.startsWith('SQLITE_CONSTRAINT_FOREIGNKEY')) {
          throw new Error('School or developer does not exist');
        }
        throw error;
      }
    }

    return this.findById(id);
  }

  async remove(id: number): Promise<boolean> {
    return this.db.prepare('DELETE FROM ovas WHERE id = ?').run(id).changes > 0;
  }

  async stats(): Promise<OvaStats> {
    const { total } = this.db.prepare('SELECT COUNT(*) AS total FROM ovas').get() as {
      total: number;
    };

    const bySchool = (
      this.db
        .prepare(
          `SELECT s.id, s.name, s.slug, COUNT(o.id) AS count
           FROM schools s LEFT JOIN ovas o ON o.school_id = s.id
           GROUP BY s.id ORDER BY s.name`,
        )
        .all() as (SchoolRecord & { count: number })[]
    ).map(({ count, ...school }) => ({ school, count }));

    const byDeveloper = (
      this.db
        .prepare(
          `SELECT d.id, d.name, COUNT(o.id) AS count
           FROM developers d LEFT JOIN ovas o ON o.developer_id = d.id
           GROUP BY d.id ORDER BY d.name`,
        )
        .all() as (DeveloperRecord & { count: number })[]
    ).map(({ count, ...developer }) => ({ developer, count }));

    return { total, bySchool, byDeveloper };
  }

  // ---- Registro de actividad ----

  async record(entry: NewAuditEntry): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO audit_log (actor, action, repo_name, repo_url, details) VALUES (?, ?, ?, ?, ?)',
      )
      .run(entry.actor, entry.action, entry.repoName, entry.repoUrl, JSON.stringify(entry.details));
  }

  async listActivity(filter: AuditFilter, limit: number, offset: number): Promise<AuditPage> {
    const { action, search } = filter;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (search?.trim()) {
      conditions.push("(repo_name LIKE ? ESCAPE '\\' OR actor LIKE ? ESCAPE '\\')");
      const like = `%${search.trim().replace(/[\\%_]/g, '\\$&')}%`;
      params.push(like, like);
    }
    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

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

  private mapUser(row: UserRow): UserRecord {
    return { login: row.login, role: row.role, createdAt: row.created_at };
  }

  private mapOva(row: OvaRow): OvaRecord {
    return {
      id: row.id,
      repoName: row.repo_name,
      repoUrl: row.repo_url,
      school: { id: row.school_id, name: row.school_name, slug: row.school_slug },
      developer: { id: row.developer_id, name: row.developer_name },
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
