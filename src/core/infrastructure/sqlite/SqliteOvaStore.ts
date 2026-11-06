import type Database from 'better-sqlite3';
import { DuplicateEntryError } from '../../application/errors';
import type {
  ProjectChanges,
  ProjectRecord,
  ProjectStore,
  SignInRecorder,
} from '../../application/projects';
import type { ProjectDetails } from '../../domain/Project';
import { openDatabase, type OpenOptions } from './schema';
import { SqliteProjectStore, isUniqueViolation } from './SqliteProjectStore';

interface ProjectRow {
  id: number;
  slug: string;
  name: string;
  org: string;
  template: string;
  default_team: string;
  description_prefix: string;
  total: number;
  created_at: string;
}

const PROJECT_COLUMNS = `p.id, p.slug, p.name, p.org, p.template, p.default_team,
                         p.description_prefix, p.total, p.created_at`;

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    org: row.org,
    template: row.template,
    defaultTeam: row.default_team,
    descriptionPrefix: row.description_prefix,
    total: row.total,
    createdAt: row.created_at,
  };
}

/**
 * Base de datos de la herramienta sobre SQLite: proyectos y acceso a ellos.
 * Lo de cada proyecto (catálogo, OVAs, usuarios, actividad) se obtiene con `forProject`.
 * Usa `:memory:` como ruta para pruebas.
 */
export class SqliteOvaStore implements ProjectStore, SignInRecorder {
  private readonly db: Database.Database;

  constructor(path: string, options: OpenOptions = {}) {
    this.db = openDatabase(path, options);
  }

  close(): void {
    this.db.close();
  }

  /**
   * Copia consistente de toda la base en `destination`, sin parar la aplicación.
   * Usa la API de respaldo de SQLite: tiene en cuenta lo que aún no se volcó del modo WAL.
   */
  async backupTo(destination: string): Promise<void> {
    await this.db.backup(destination);
  }

  /** Almacén acotado a un proyecto: implementa el registro, el catálogo, los usuarios y la actividad. */
  forProject(projectId: number): SqliteProjectStore {
    return new SqliteProjectStore(this.db, projectId);
  }

  // ---- Proyectos ----

  async listProjects(): Promise<ProjectRecord[]> {
    const rows = this.db
      .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects p ORDER BY p.name`)
      .all() as ProjectRow[];
    return rows.map(mapProject);
  }

  async listProjectsFor(login: string): Promise<ProjectRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT ${PROJECT_COLUMNS} FROM projects p
         JOIN members m ON m.project_id = p.id
         WHERE m.login = ? AND m.verified_at IS NOT NULL
         ORDER BY p.name`,
      )
      .all(login) as ProjectRow[];
    return rows.map(mapProject);
  }

  async findProject(slug: string): Promise<ProjectRecord | null> {
    const row = this.db
      .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.slug = ?`)
      .get(slug) as ProjectRow | undefined;
    return row ? mapProject(row) : null;
  }

  async findProjectById(id: number): Promise<ProjectRecord | null> {
    const row = this.db
      .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects p WHERE p.id = ?`)
      .get(id) as ProjectRow | undefined;
    return row ? mapProject(row) : null;
  }

  async createProject(project: ProjectDetails): Promise<ProjectRecord> {
    let id: number;
    try {
      const info = this.db
        .prepare(
          `INSERT INTO projects (slug, name, org, template, default_team, description_prefix, total)
           VALUES (@slug, @name, @org, @template, @defaultTeam, @descriptionPrefix, @total)`,
        )
        .run(project);
      id = Number(info.lastInsertRowid);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const onOrg = String((error as Error).message).includes('projects.org');
        throw new DuplicateEntryError(
          onOrg
            ? `Organization already registered: ${project.org}`
            : `Project already exists: ${project.slug}`,
        );
      }
      throw error;
    }
    return (await this.findProjectById(id)) as ProjectRecord;
  }

  async updateProject(id: number, changes: ProjectChanges): Promise<ProjectRecord | null> {
    const columns: Record<keyof ProjectChanges, string> = {
      name: 'name',
      template: 'template',
      defaultTeam: 'default_team',
      descriptionPrefix: 'description_prefix',
      total: 'total',
    };
    const sets: string[] = [];
    const params: (string | number)[] = [];
    for (const [key, column] of Object.entries(columns) as [keyof ProjectChanges, string][]) {
      const value = changes[key];
      if (value !== undefined) {
        sets.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (sets.length > 0) {
      const info = this.db
        .prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`)
        .run(...params, id);
      if (info.changes === 0) return null;
    }
    return this.findProjectById(id);
  }

  // ---- Acceso ----

  async recordSignIn(
    projectId: number,
    login: string,
    isOrgMember: boolean,
    defaultRole: 'viewer',
  ): Promise<void> {
    if (isOrgMember) {
      this.db
        .prepare(
          `INSERT INTO members (project_id, login, role, verified_at)
           VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
           ON CONFLICT (project_id, login)
           DO UPDATE SET verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .run(projectId, login, defaultRole);
    } else {
      this.db
        .prepare('UPDATE members SET verified_at = NULL WHERE project_id = ? AND login = ?')
        .run(projectId, login);
    }
  }
}
