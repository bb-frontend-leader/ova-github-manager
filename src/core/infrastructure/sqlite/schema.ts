import Database from 'better-sqlite3';
import { copyFileSync } from 'node:fs';
import type { ProjectDetails } from '../../domain/Project';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Esquema actual. Cada proyecto tiene su propio catálogo, OVAs, usuarios y actividad. */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS projects (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    slug               TEXT NOT NULL UNIQUE,
    name               TEXT NOT NULL,
    org                TEXT NOT NULL UNIQUE COLLATE NOCASE,
    template           TEXT NOT NULL,
    default_team       TEXT NOT NULL,
    description_prefix TEXT NOT NULL,
    total              INTEGER NOT NULL CHECK (total > 0),
    created_at         TEXT NOT NULL DEFAULT (${NOW})
  );

  CREATE TABLE IF NOT EXISTS schools (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    name       TEXT NOT NULL COLLATE NOCASE,
    slug       TEXT NOT NULL,
    UNIQUE (project_id, name),
    UNIQUE (project_id, slug)
  );

  CREATE TABLE IF NOT EXISTS developers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id),
    name         TEXT NOT NULL COLLATE NOCASE,
    -- Usuario de GitHub de la persona (para "Mi trabajo"); NULL = sin vincular
    github_login TEXT COLLATE NOCASE,
    UNIQUE (project_id, name)
  );

  CREATE TABLE IF NOT EXISTS ovas (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id        INTEGER NOT NULL REFERENCES projects(id),
    repo_name         TEXT NOT NULL COLLATE NOCASE,
    repo_url          TEXT NOT NULL,
    school_id         INTEGER NOT NULL REFERENCES schools(id),
    developer_id      INTEGER NOT NULL REFERENCES developers(id),
    created_by        TEXT NOT NULL,
    created_at        TEXT NOT NULL DEFAULT (${NOW}),
    status            TEXT NOT NULL DEFAULT 'development'
                      CHECK (status IN ('development', 'review', 'delivered')),
    -- Cuándo pasó al estado actual (NULL = desde que se creó)
    status_changed_at TEXT,
    UNIQUE (project_id, repo_name)
  );

  CREATE TABLE IF NOT EXISTS members (
    project_id  INTEGER NOT NULL REFERENCES projects(id),
    login       TEXT NOT NULL COLLATE NOCASE,
    role        TEXT NOT NULL CHECK (role IN ('viewer', 'creator', 'admin')),
    created_at  TEXT NOT NULL DEFAULT (${NOW}),
    -- Cuándo se comprobó por última vez que es miembro de la organización (NULL = sin verificar)
    verified_at TEXT,
    PRIMARY KEY (project_id, login)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    at         TEXT NOT NULL DEFAULT (${NOW}),
    actor      TEXT NOT NULL,
    action     TEXT NOT NULL,
    repo_name  TEXT NOT NULL,
    repo_url   TEXT NOT NULL,
    details    TEXT NOT NULL DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_ovas_project ON ovas(project_id);
  CREATE INDEX IF NOT EXISTS idx_ovas_school ON ovas(school_id);
  CREATE INDEX IF NOT EXISTS idx_ovas_developer ON ovas(developer_id);
  CREATE INDEX IF NOT EXISTS idx_audit_project_at ON audit_log(project_id, at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_members_login ON members(login);
`;

function tableExists(db: Database.Database, name: string): boolean {
  return db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !== undefined;
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.some((c) => c.name === column);
}

/**
 * Añade a una base ya existente lo que se incorporó después de crearla (el esquema solo crea
 * tablas que faltan, no completa las que ya existen). Es idempotente.
 */
function ensureColumns(db: Database.Database): void {
  db.transaction(() => {
    if (!hasColumn(db, 'ovas', 'status')) {
      db.exec(
        `ALTER TABLE ovas ADD COLUMN status TEXT NOT NULL DEFAULT 'development'
           CHECK (status IN ('development', 'review', 'delivered'))`,
      );
    }
    if (!hasColumn(db, 'ovas', 'status_changed_at')) {
      db.exec('ALTER TABLE ovas ADD COLUMN status_changed_at TEXT');
    }
    if (!hasColumn(db, 'developers', 'github_login')) {
      db.exec('ALTER TABLE developers ADD COLUMN github_login TEXT COLLATE NOCASE');
    }
    // Un usuario de GitHub solo puede estar vinculado a un desarrollador por proyecto
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_developers_login
         ON developers(project_id, github_login) WHERE github_login IS NOT NULL`,
    );
    db.exec('CREATE INDEX IF NOT EXISTS idx_ovas_status ON ovas(project_id, status)');
  })();
}

/** Una base de la versión anterior tiene el catálogo y las OVAs sin proyecto. */
function isLegacy(db: Database.Database): boolean {
  return tableExists(db, 'schools') && !hasColumn(db, 'schools', 'project_id');
}

/**
 * Pasa una base de la versión de un solo proyecto a la actual: todo lo existente queda dentro de
 * un primer proyecto (`legacyProject`), con sus usuarios como miembros de él.
 * Va en una transacción: o se migra todo o no se cambia nada.
 */
function migrateLegacy(db: Database.Database, legacyProject: ProjectDetails): void {
  const rename = ['schools', 'developers', 'ovas', 'users', 'audit_log'].filter((t) => tableExists(db, t));

  // En este modo SQLite no reescribe las referencias de las tablas hijas al renombrar
  db.pragma('legacy_alter_table = ON');
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      for (const table of rename) db.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy`);
      db.exec(SCHEMA);

      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO projects (slug, name, org, template, default_team, description_prefix, total)
           VALUES (@slug, @name, @org, @template, @defaultTeam, @descriptionPrefix, @total)`,
        )
        .run(legacyProject);
      const projectId = Number(lastInsertRowid);

      const has = (table: string) => rename.includes(table);
      if (has('schools')) {
        db.prepare('INSERT INTO schools (id, project_id, name, slug) SELECT id, ?, name, slug FROM schools_legacy').run(projectId);
      }
      if (has('developers')) {
        db.prepare('INSERT INTO developers (id, project_id, name) SELECT id, ?, name FROM developers_legacy').run(projectId);
      }
      if (has('ovas')) {
        db.prepare(
          `INSERT INTO ovas (id, project_id, repo_name, repo_url, school_id, developer_id, created_by, created_at)
           SELECT id, ?, repo_name, repo_url, school_id, developer_id, created_by, created_at FROM ovas_legacy`,
        ).run(projectId);
      }
      if (has('users')) {
        // Ya habían pasado por el control de membresía al iniciar sesión: se conservan verificados
        db.prepare(
          `INSERT INTO members (project_id, login, role, created_at, verified_at)
           SELECT ?, login, role, created_at, ${NOW} FROM users_legacy`,
        ).run(projectId);
      }
      if (has('audit_log')) {
        db.prepare(
          `INSERT INTO audit_log (id, project_id, at, actor, action, repo_name, repo_url, details)
           SELECT id, ?, at, actor, action, repo_name, repo_url, details FROM audit_log_legacy`,
        ).run(projectId);
      }

      for (const table of [...rename].reverse()) db.exec(`DROP TABLE ${table}_legacy`);
      // Los índices antiguos se iban con las tablas viejas: se crean los del esquema nuevo
      db.exec(SCHEMA);

      const broken = db.pragma('foreign_key_check') as unknown[];
      if (broken.length > 0) throw new Error('Migration aborted: inconsistent data');
    })();
  } finally {
    db.pragma('legacy_alter_table = OFF');
    db.pragma('foreign_keys = ON');
  }
}

export interface OpenOptions {
  /**
   * Datos del proyecto en el que se integra una base de la versión anterior (de un solo proyecto).
   * Solo hace falta al migrar; una base nueva o ya migrada no lo usa.
   */
  legacyProject?: ProjectDetails;
}

/** Abre la base de datos, la migra si viene de la versión anterior y asegura el esquema. */
export function openDatabase(path: string, options: OpenOptions = {}): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  if (isLegacy(db)) {
    if (!options.legacyProject) {
      db.close();
      throw new Error('Legacy database needs the settings of its project (set GITHUB_ORG) to be migrated');
    }
    // Copia de seguridad antes de tocar nada: si algo sale mal, se recupera la base tal cual estaba
    if (path !== ':memory:' && path !== '') {
      db.pragma('wal_checkpoint(TRUNCATE)');
      copyFileSync(path, `${path}.pre-projects.bak`);
    }
    migrateLegacy(db, options.legacyProject);
  } else {
    db.exec(SCHEMA);
  }
  ensureColumns(db);
  return db;
}
