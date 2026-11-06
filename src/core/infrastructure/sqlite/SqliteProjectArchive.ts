import type Database from 'better-sqlite3';
import type { AuditAction, AuditDetails } from '../../application/audit';
import { DuplicateEntryError } from '../../application/errors';
import type { ProjectSnapshot } from '../../application/ProjectArchive';
import type { Role } from '../../domain/Role';
import type { OvaStatus } from '../../domain/OvaStatus';
import { isUniqueViolation } from './SqliteProjectStore';

/** Traduce el fallo de unicidad al insertar un proyecto en un error que la aplicación entiende. */
export function asProjectConflict(error: unknown, project: { slug: string; org: string }): unknown {
  if (!isUniqueViolation(error)) return error;
  const onOrg = String((error as Error).message).includes('projects.org');
  return new DuplicateEntryError(
    onOrg ? `Organization already registered: ${project.org}` : `Project already exists: ${project.slug}`,
  );
}

function parseDetails(raw: string): AuditDetails {
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as AuditDetails) : {};
  } catch {
    return {}; // una fila dañada no debe impedir exportar el resto
  }
}

/** Todo lo de un proyecto, listo para guardarse en un archivo. null si el proyecto no existe. */
export function readProjectSnapshot(db: Database.Database, projectId: number): ProjectSnapshot | null {
  // Una sola transacción de lectura: el archivo refleja un único instante, aunque haya escrituras en curso
  return db.transaction((): ProjectSnapshot | null => {
    const project = db
      .prepare(
        `SELECT slug, name, org, template, default_team AS defaultTeam,
                description_prefix AS descriptionPrefix, total, created_at AS createdAt
         FROM projects WHERE id = ?`,
      )
      .get(projectId) as ProjectSnapshot['project'] | undefined;
    if (!project) return null;

    const schools = db
      .prepare('SELECT name, slug FROM schools WHERE project_id = ? ORDER BY name')
      .all(projectId) as ProjectSnapshot['schools'];

    const developers = db
      .prepare('SELECT name, github_login AS githubLogin FROM developers WHERE project_id = ? ORDER BY name')
      .all(projectId) as ProjectSnapshot['developers'];

    const ovas = (
      db
        .prepare(
          `SELECT o.repo_name AS repoName, o.repo_url AS repoUrl, s.slug AS school, d.name AS developer,
                  o.created_by AS createdBy, o.created_at AS createdAt, o.status AS status,
                  o.status_changed_at AS statusChangedAt
           FROM ovas o
           JOIN schools s ON s.id = o.school_id
           JOIN developers d ON d.id = o.developer_id
           WHERE o.project_id = ?
           ORDER BY o.id`,
        )
        .all(projectId) as (Omit<ProjectSnapshot['ovas'][number], 'status'> & { status: OvaStatus })[]
    );

    const members = (
      db
        .prepare('SELECT login, role, created_at AS createdAt FROM members WHERE project_id = ? ORDER BY login')
        .all(projectId) as { login: string; role: Role; createdAt: string }[]
    );

    const activity = (
      db
        .prepare(
          `SELECT at, actor, action, repo_name AS repoName, repo_url AS repoUrl, details
           FROM audit_log WHERE project_id = ? ORDER BY at, id`,
        )
        .all(projectId) as {
        at: string;
        actor: string;
        action: AuditAction;
        repoName: string;
        repoUrl: string;
        details: string;
      }[]
    ).map(({ details, ...entry }) => ({ ...entry, details: parseDetails(details) }));

    return { project, schools, developers, ovas, members, activity };
  })();
}

/**
 * Crea el proyecto y todo su contenido en una transacción: si algo falla no queda nada a medias.
 * Devuelve el id del proyecto nuevo. Los usuarios entran sin verificar (verified_at = NULL).
 */
export function importProjectSnapshot(db: Database.Database, snapshot: ProjectSnapshot): number {
  const { project } = snapshot;

  return db.transaction((): number => {
    let projectId: number;
    try {
      const info = db
        .prepare(
          `INSERT INTO projects (slug, name, org, template, default_team, description_prefix, total, created_at)
           VALUES (@slug, @name, @org, @template, @defaultTeam, @descriptionPrefix, @total, @createdAt)`,
        )
        .run(project);
      projectId = Number(info.lastInsertRowid);
    } catch (error) {
      throw asProjectConflict(error, project);
    }

    const schoolIds = new Map<string, number>();
    const addSchool = db.prepare('INSERT INTO schools (project_id, name, slug) VALUES (?, ?, ?)');
    for (const school of snapshot.schools) {
      schoolIds.set(school.slug, Number(addSchool.run(projectId, school.name, school.slug).lastInsertRowid));
    }

    const developerIds = new Map<string, number>();
    const addDeveloper = db.prepare('INSERT INTO developers (project_id, name, github_login) VALUES (?, ?, ?)');
    for (const developer of snapshot.developers) {
      developerIds.set(
        developer.name.toLowerCase(),
        Number(addDeveloper.run(projectId, developer.name, developer.githubLogin).lastInsertRowid),
      );
    }

    const addOva = db.prepare(
      `INSERT INTO ovas (project_id, repo_name, repo_url, school_id, developer_id, created_by, created_at,
                         status, status_changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const ova of snapshot.ovas) {
      const schoolId = schoolIds.get(ova.school);
      const developerId = developerIds.get(ova.developer.toLowerCase());
      if (schoolId === undefined || developerId === undefined) {
        throw new Error(`Archive is inconsistent: ${ova.repoName}`);
      }
      addOva.run(
        projectId,
        ova.repoName,
        ova.repoUrl,
        schoolId,
        developerId,
        ova.createdBy,
        ova.createdAt,
        ova.status,
        ova.statusChangedAt,
      );
    }

    // verified_at queda en NULL: el acceso se verifica al iniciar sesión, no se hereda del archivo
    const addMember = db.prepare('INSERT INTO members (project_id, login, role, created_at) VALUES (?, ?, ?, ?)');
    for (const member of snapshot.members) addMember.run(projectId, member.login, member.role, member.createdAt);

    const addEntry = db.prepare(
      `INSERT INTO audit_log (project_id, at, actor, action, repo_name, repo_url, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const entry of snapshot.activity) {
      addEntry.run(
        projectId,
        entry.at,
        entry.actor,
        entry.action,
        entry.repoName,
        entry.repoUrl,
        JSON.stringify(entry.details),
      );
    }

    return projectId;
  })();
}
