import { Developer } from '../domain/Developer';
import { GithubLogin } from '../domain/GithubLogin';
import { isOvaStatus, type OvaStatus } from '../domain/OvaStatus';
import { Project, type ProjectDetails } from '../domain/Project';
import { isRole, type Role } from '../domain/Role';
import { School } from '../domain/School';
import { AUDIT_ACTIONS, type AuditAction, type AuditChange, type AuditDetails } from './audit';
import type { ProjectGateway } from './ManageProjectsUseCase';
import type { ProjectRecord } from './projects';

/**
 * Exportar e importar un proyecto completo: ajustes, catálogo, OVAs, usuarios y actividad en un
 * solo archivo JSON. Sirve para pasar un proyecto a otra instalación o recuperarlo.
 *
 * Importar siempre CREA un proyecto nuevo; nunca mezcla ni sobrescribe uno existente.
 */

export const ARCHIVE_FORMAT = 'ova-github-manager/project';
export const ARCHIVE_VERSION = 1;

export interface ArchivedProject extends ProjectDetails {
  /** ISO 8601, UTC */
  createdAt: string;
}

export interface ArchivedSchool {
  name: string;
  slug: string;
}

export interface ArchivedDeveloper {
  name: string;
  githubLogin: string | null;
}

export interface ArchivedOva {
  repoName: string;
  repoUrl: string;
  /** Identificador (slug) de su escuela */
  school: string;
  /** Nombre de su desarrollador */
  developer: string;
  createdBy: string;
  createdAt: string;
  status: OvaStatus;
  /** null = desde que se creó */
  statusChangedAt: string | null;
}

export interface ArchivedMember {
  login: string;
  role: Role;
  createdAt: string;
}

export interface ArchivedActivity {
  at: string;
  actor: string;
  action: AuditAction;
  repoName: string;
  repoUrl: string;
  details: AuditDetails;
}

/** Todo el contenido de un proyecto, sin los datos del archivo que lo contiene. */
export interface ProjectSnapshot {
  project: ArchivedProject;
  schools: ArchivedSchool[];
  developers: ArchivedDeveloper[];
  ovas: ArchivedOva[];
  members: ArchivedMember[];
  /** De la más antigua a la más reciente */
  activity: ArchivedActivity[];
}

export interface ProjectArchive extends ProjectSnapshot {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  /** ISO 8601, UTC */
  exportedAt: string;
  exportedBy: string;
}

export interface ProjectArchiveStore {
  /** Todo lo del proyecto; null si no existe */
  readProject(projectId: number): Promise<ProjectSnapshot | null>;
  /**
   * Crea el proyecto con todo su contenido en una sola operación: o se guarda todo o nada.
   * Lanza DuplicateEntryError si el identificador o la organización ya están en uso.
   */
  importProject(snapshot: ProjectSnapshot): Promise<ProjectRecord>;
}

export interface ArchiveCounts {
  schools: number;
  developers: number;
  ovas: number;
  members: number;
  activity: number;
}

export interface ExportResult {
  /** Nombre sugerido para el archivo */
  fileName: string;
  json: string;
  counts: ArchiveCounts;
}

export interface ImportResult {
  project: ProjectRecord;
  counts: ArchiveCounts;
}

export interface ImportOptions {
  /** Identificador distinto del que trae el archivo (p. ej. si ya hay un proyecto con ese) */
  slug?: string;
}

// ---- Lectura y validación del archivo ----

const MAX_ITEMS = 1_000_000;
const MAX_TEXT = 300;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Reglas de GitHub para el nombre de un repositorio
const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;

type Json = Record<string, unknown>;

/**
 * Un dato del archivo no es válido. El mensaje lleva la ruta del dato (p. ej. `ovas[12].status`)
 * y un código corto: required | invalid | duplicate | unknown-school | unknown-developer | too-many
 */
function bad(path: string, code: string): never {
  throw new Error(`Invalid project file at ${path}: ${code}`);
}

function object(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) bad(path, 'invalid');
  return value as Json;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) bad(path, 'invalid');
  if (value.length > MAX_ITEMS) bad(path, 'too-many');
  return value;
}

function text(value: unknown, path: string, options: { allowEmpty?: boolean } = {}): string {
  if (typeof value !== 'string') bad(path, value === undefined || value === null ? 'required' : 'invalid');
  const trimmed = value.trim();
  if (trimmed.length === 0 && !options.allowEmpty) bad(path, 'required');
  if (trimmed.length > MAX_TEXT) bad(path, 'invalid');
  return trimmed;
}

function date(value: unknown, path: string): string {
  const raw = text(value, path);
  const time = Date.parse(raw);
  if (Number.isNaN(time)) bad(path, 'invalid');
  return new Date(time).toISOString();
}

/** Dirección de un repositorio: solo https (el archivo no puede colar enlaces `javascript:`). */
function repoUrl(value: unknown, path: string, options: { allowEmpty?: boolean } = {}): string {
  const url = text(value, path, options);
  if (url !== '' && !/^https:\/\/\S+$/.test(url)) bad(path, 'invalid');
  return url;
}

function attempt<T>(path: string, build: () => T): T {
  try {
    return build();
  } catch {
    return bad(path, 'invalid');
  }
}

function unique(seen: Set<string>, key: string, path: string): void {
  if (seen.has(key)) bad(path, 'duplicate');
  seen.add(key);
}

const CHANGE_FIELDS: readonly string[] = ['school', 'developer', 'status'];

function clip(value: string): string {
  return value.slice(0, MAX_TEXT);
}

/** Deja solo los datos conocidos y con su forma: la pantalla de actividad no debe romperse por un archivo mal hecho. */
function auditDetails(value: unknown, path: string): AuditDetails {
  if (value === undefined || value === null) return {};
  const raw = object(value, path);
  const details: AuditDetails = {};
  if (typeof raw.school === 'string') details.school = clip(raw.school);
  if (typeof raw.developer === 'string') details.developer = clip(raw.developer);
  if (raw.reason === 'deleted_in_github') details.reason = 'deleted_in_github';
  if (Array.isArray(raw.changes)) {
    details.changes = raw.changes.flatMap((item): AuditChange[] => {
      const change = item as Partial<AuditChange> | null;
      if (
        change &&
        typeof change.field === 'string' &&
        CHANGE_FIELDS.includes(change.field) &&
        typeof change.from === 'string' &&
        typeof change.to === 'string'
      ) {
        return [{ field: change.field, from: clip(change.from), to: clip(change.to) }];
      }
      return [];
    });
  }
  if (Array.isArray(raw.fixed)) {
    details.fixed = raw.fixed.filter((f): f is string => typeof f === 'string').map(clip);
  }
  return details;
}

/**
 * Lee y valida el contenido de un archivo exportado. Lo que viene de fuera nunca se da por bueno:
 * se comprueba cada dato, se normaliza igual que si se hubiera escrito en la herramienta y se
 * rechaza el archivo entero si algo no cuadra (no se importa a medias).
 */
export function parseProjectArchive(content: string): ProjectArchive {
  let raw: unknown;
  try {
    raw = JSON.parse(content.replace(/^﻿/, ''));
  } catch {
    throw new Error('Project file is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || (raw as Json).format !== ARCHIVE_FORMAT) {
    throw new Error('Project file is not a project export');
  }
  const root = raw as Json;
  if (root.version !== ARCHIVE_VERSION) {
    throw new Error(`Project file version not supported: ${String(root.version)}`);
  }

  // Proyecto
  const rawProject = object(root.project, 'project');
  const field = (key: string) => text(rawProject[key], `project.${key}`);
  const total = rawProject.total;
  if (typeof total !== 'number' && typeof total !== 'string') bad('project.total', 'required');
  const details = Project.validate({
    name: field('name'),
    org: field('org'),
    slug: field('slug'),
    template: field('template'),
    defaultTeam: field('defaultTeam'),
    descriptionPrefix: field('descriptionPrefix'),
    total,
  });
  const project: ArchivedProject = { ...details, createdAt: date(rawProject.createdAt, 'project.createdAt') };

  // Escuelas
  const schoolNames = new Set<string>();
  const schoolSlugs = new Set<string>();
  const schools = list(root.schools, 'schools').map((item, i): ArchivedSchool => {
    const path = `schools[${i}]`;
    const entry = object(item, path);
    const name = attempt(`${path}.name`, () => School.create(text(entry.name, `${path}.name`)).getName());
    const slug = text(entry.slug, `${path}.slug`);
    if (!SLUG.test(slug) || slug.length > 50) bad(`${path}.slug`, 'invalid');
    unique(schoolNames, name.toLowerCase(), `${path}.name`);
    unique(schoolSlugs, slug, `${path}.slug`);
    return { name, slug };
  });

  // Desarrolladores
  const developerNames = new Set<string>();
  const developerLogins = new Set<string>();
  const developers = list(root.developers, 'developers').map((item, i): ArchivedDeveloper => {
    const path = `developers[${i}]`;
    const entry = object(item, path);
    const name = attempt(`${path}.name`, () => Developer.create(text(entry.name, `${path}.name`)).getName());
    unique(developerNames, name.toLowerCase(), `${path}.name`);
    let githubLogin: string | null = null;
    if (entry.githubLogin !== undefined && entry.githubLogin !== null) {
      githubLogin = attempt(`${path}.githubLogin`, () =>
        GithubLogin.create(text(entry.githubLogin, `${path}.githubLogin`)).getValue(),
      );
      unique(developerLogins, githubLogin, `${path}.githubLogin`);
    }
    return { name, githubLogin };
  });

  // OVAs
  const repoNames = new Set<string>();
  const ovas = list(root.ovas, 'ovas').map((item, i): ArchivedOva => {
    const path = `ovas[${i}]`;
    const entry = object(item, path);
    const repoName = text(entry.repoName, `${path}.repoName`);
    if (!REPO_NAME.test(repoName)) bad(`${path}.repoName`, 'invalid');
    unique(repoNames, repoName.toLowerCase(), `${path}.repoName`);

    const school = text(entry.school, `${path}.school`);
    if (!schoolSlugs.has(school)) bad(`${path}.school`, 'unknown-school');
    const developer = text(entry.developer, `${path}.developer`).replace(/\s+/g, ' ');
    if (!developerNames.has(developer.toLowerCase())) bad(`${path}.developer`, 'unknown-developer');

    if (!isOvaStatus(entry.status)) bad(`${path}.status`, 'invalid');
    return {
      repoName,
      repoUrl: repoUrl(entry.repoUrl, `${path}.repoUrl`),
      school,
      developer,
      createdBy: text(entry.createdBy, `${path}.createdBy`),
      createdAt: date(entry.createdAt, `${path}.createdAt`),
      status: entry.status,
      statusChangedAt:
        entry.statusChangedAt === undefined || entry.statusChangedAt === null
          ? null
          : date(entry.statusChangedAt, `${path}.statusChangedAt`),
    };
  });

  // Usuarios
  const logins = new Set<string>();
  const members = list(root.members, 'members').map((item, i): ArchivedMember => {
    const path = `members[${i}]`;
    const entry = object(item, path);
    const login = attempt(`${path}.login`, () => GithubLogin.create(text(entry.login, `${path}.login`)).getValue());
    unique(logins, login, `${path}.login`);
    if (!isRole(entry.role)) bad(`${path}.role`, 'invalid');
    return { login, role: entry.role, createdAt: date(entry.createdAt, `${path}.createdAt`) };
  });

  // Actividad (de la más antigua a la más reciente; el orden es estable)
  const activity = list(root.activity, 'activity')
    .map((item, i): ArchivedActivity => {
      const path = `activity[${i}]`;
      const entry = object(item, path);
      if (!(AUDIT_ACTIONS as readonly string[]).includes(entry.action as string)) bad(`${path}.action`, 'invalid');
      return {
        at: date(entry.at, `${path}.at`),
        actor: text(entry.actor, `${path}.actor`),
        action: entry.action as AuditAction,
        repoName: text(entry.repoName, `${path}.repoName`),
        repoUrl: repoUrl(entry.repoUrl, `${path}.repoUrl`, { allowEmpty: true }),
        details: auditDetails(entry.details, `${path}.details`),
      };
    })
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  return {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    exportedAt: date(root.exportedAt, 'exportedAt'),
    exportedBy: text(root.exportedBy, 'exportedBy'),
    project,
    schools,
    developers,
    ovas,
    members,
    activity,
  };
}

function countsOf(snapshot: ProjectSnapshot): ArchiveCounts {
  return {
    schools: snapshot.schools.length,
    developers: snapshot.developers.length,
    ovas: snapshot.ovas.length,
    members: snapshot.members.length,
    activity: snapshot.activity.length,
  };
}

/**
 * Exporta un proyecto a un archivo y crea un proyecto nuevo a partir de uno.
 * Solo debe invocarlo un super administrador: el archivo lleva los usuarios y la actividad.
 */
export class ProjectArchiveUseCase {
  constructor(
    private readonly store: ProjectArchiveStore,
    private readonly gateway: Pick<ProjectGateway, 'validateOrgAccess'>,
  ) {}

  async export(projectId: number, exportedBy: string, now: Date = new Date()): Promise<ExportResult> {
    const snapshot = await this.store.readProject(projectId);
    if (!snapshot) throw new Error('Project not found');

    const archive: ProjectArchive = {
      format: ARCHIVE_FORMAT,
      version: ARCHIVE_VERSION,
      exportedAt: now.toISOString(),
      exportedBy,
      ...snapshot,
    };
    return {
      fileName: `${snapshot.project.slug}-proyecto-${now.toISOString().slice(0, 10)}.json`,
      json: JSON.stringify(archive, null, 2),
      counts: countsOf(snapshot),
    };
  }

  /**
   * Crea un proyecto nuevo con el contenido del archivo. Los usuarios entran sin verificar:
   * recuperan el acceso al iniciar sesión, cuando se comprueba que siguen en la organización.
   */
  async import(content: string, options: ImportOptions = {}): Promise<ImportResult> {
    const archive = parseProjectArchive(content);

    const slug = options.slug?.trim() ? options.slug : archive.project.slug;
    const details = Project.validate({ ...archive.project, slug });
    await this.gateway.validateOrgAccess(details.org);

    const snapshot: ProjectSnapshot = {
      project: { ...details, createdAt: archive.project.createdAt },
      schools: archive.schools,
      developers: archive.developers,
      ovas: archive.ovas,
      members: archive.members,
      activity: archive.activity,
    };
    const project = await this.store.importProject(snapshot);
    return { project, counts: countsOf(snapshot) };
  }
}
