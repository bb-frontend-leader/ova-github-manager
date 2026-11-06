import { SYSTEM_ACTOR, type AuditLog } from './audit';
import {
  TEAM_PERMISSION_RANK,
  type RepositoryGateway,
  type RepositoryInspector,
  type TeamPermissionLevel,
} from './ports';
import type { Catalog, OvaRecord, OvaRegistry, SchoolRecord } from './registry';

export interface ReconcileConfig {
  org: string;
  /** Plantilla de las OVAs (puede ser "owner/repo"): no se ofrece para adoptarla */
  template?: string;
  /** Team que debe tener acceso a cada OVA y el permiso mínimo que debe tener */
  team: { slug: string; permission: TeamPermissionLevel };
}

/** Lo que le falta a una OVA registrada para estar como la crea la herramienta. */
export type RepairIssue = 'missing_topic' | 'missing_team' | 'insufficient_permission';

export interface OvaRepair {
  ova: OvaRecord;
  issues: RepairIssue[];
  /** Permiso actual del team; null si no tiene acceso */
  teamPermission: TeamPermissionLevel | null;
}

/** Repositorio de la organización que no está en el registro. */
export interface UnregisteredRepo {
  name: string;
  url: string;
  topics: string[];
  /** Escuela cuyo topic ya tiene el repositorio, si hay alguna */
  suggestedSchool: SchoolRecord | null;
  /** Tiene topic de escuela o el team ya tiene acceso: es muy probable que sea una OVA */
  probableOva: boolean;
}

export interface ReconcileReport {
  /** Repositorios de la organización revisados */
  checked: number;
  repairs: OvaRepair[];
  unregistered: UnregisteredRepo[];
  /** Si no se pudo leer el team, no se revisan sus permisos y se explica por qué */
  teamError?: string;
}

export interface RepairOutcome {
  repoName: string;
  success: boolean;
  /** Qué se corrigió, en texto legible */
  fixed: string[];
  error?: string;
}

export interface RepairAllResult {
  outcomes: RepairOutcome[];
  /** Cuántas siguen pendientes (se corrigen por tandas para no saturar a GitHub) */
  remaining: number;
}

export type AdoptResult =
  | { success: true; ova: OvaRecord; fixed: string[]; warnings: string[] }
  | { success: false; message: string };

/** Cuántas OVAs se corrigen por tanda: cada una son varias llamadas a GitHub. */
export const REPAIR_BATCH_SIZE = 25;

function repoPart(template: string): string {
  return (template.includes('/') ? template.split('/')[1] : template).toLowerCase();
}

/**
 * Compara GitHub con el registro y arregla lo que quedó a medias:
 *  - OVAs registradas sin el topic de su escuela o sin el team (o con menos permiso del debido);
 *  - repositorios que existen en la organización pero no están registrados (p. ej. porque GitHub
 *    respondió con error al crearlos): se pueden adoptar con su escuela y desarrollador.
 * Solo AÑADE: nunca quita topics ni baja el permiso de un team.
 */
export class ReconcileOvasUseCase {
  constructor(
    private readonly gateway: RepositoryGateway & RepositoryInspector,
    private readonly registry: OvaRegistry,
    private readonly catalog: Catalog,
    private readonly config: ReconcileConfig,
    private readonly audit?: AuditLog,
  ) {}

  async scan(): Promise<ReconcileReport> {
    const [registered, schools, remote] = await Promise.all([
      this.registry.list(),
      this.catalog.listSchools(),
      this.gateway.listRepositories(this.config.org),
    ]);
    if (remote.length === 0) throw new Error('GitHub returned no repositories; scan aborted');

    let teamAccess: Map<string, TeamPermissionLevel> | null = null;
    let teamError: string | undefined;
    try {
      const teamRepos = await this.gateway.listTeamRepositories(this.config.org, this.config.team.slug);
      teamAccess = new Map(teamRepos.map((repo) => [repo.name.toLowerCase(), repo.permission]));
    } catch (error) {
      teamError = error instanceof Error ? error.message : 'Failed to read the team';
    }

    const remoteByName = new Map(remote.map((repo) => [repo.name.toLowerCase(), repo]));
    const registeredNames = new Set(registered.map((ova) => ova.repoName.toLowerCase()));

    const repairs: OvaRepair[] = [];
    for (const ova of registered) {
      const repo = remoteByName.get(ova.repoName.toLowerCase());
      if (!repo) continue; // borrado en GitHub: de eso se ocupa la sincronización
      const teamPermission = teamAccess?.get(repo.name.toLowerCase()) ?? null;

      const issues: RepairIssue[] = [];
      if (!(repo.topics ?? []).includes(ova.school.slug)) issues.push('missing_topic');
      if (teamAccess) {
        if (teamPermission === null) issues.push('missing_team');
        else if (this.isInsufficient(teamPermission)) issues.push('insufficient_permission');
      }
      if (issues.length > 0) repairs.push({ ova, issues, teamPermission });
    }

    const templateName = this.config.template ? repoPart(this.config.template) : null;
    const schoolBySlug = new Map(schools.map((school) => [school.slug, school]));
    const unregistered: UnregisteredRepo[] = [];
    for (const repo of remote) {
      const name = repo.name.toLowerCase();
      if (registeredNames.has(name) || repo.archived || repo.isTemplate || name === templateName) continue;
      const topics = repo.topics ?? [];
      const suggestedSchool = topics.map((topic) => schoolBySlug.get(topic)).find(Boolean) ?? null;
      unregistered.push({
        name: repo.name,
        url: repo.url,
        topics,
        suggestedSchool,
        probableOva: suggestedSchool !== null || teamAccess?.has(name) === true,
      });
    }
    // Primero los que parecen OVAs; dentro de cada grupo, por nombre
    unregistered.sort(
      (a, b) => Number(b.probableOva) - Number(a.probableOva) || a.name.localeCompare(b.name),
    );

    return { checked: remote.length, repairs, unregistered, teamError };
  }

  /** Corrige una OVA registrada leyendo su estado actual en GitHub. */
  async repair(repoName: string, actor: string = SYSTEM_ACTOR): Promise<RepairOutcome> {
    const ova = await this.registry.findByRepoName(repoName);
    if (!ova) return { repoName, success: false, fixed: [], error: 'OVA not found' };

    try {
      const [topics, teamPermission] = await Promise.all([
        this.gateway.getTopics(this.config.org, ova.repoName),
        this.gateway.getTeamPermission(this.config.org, this.config.team.slug, ova.repoName),
      ]);
      const fixed = await this.applyFixes(ova, topics, teamPermission);
      await this.recordRepair(ova, fixed, actor);
      return { repoName: ova.repoName, success: true, fixed };
    } catch (error) {
      return { repoName: ova.repoName, success: false, fixed: [], error: errorText(error) };
    }
  }

  /**
   * Corrige las OVAs con problemas, por tandas de `limit`. Una que falle no detiene a las demás.
   * Parte de un informe ya hecho para no volver a consultar a GitHub por cada repositorio.
   */
  async repairAll(
    actor: string = SYSTEM_ACTOR,
    limit: number = REPAIR_BATCH_SIZE,
  ): Promise<RepairAllResult> {
    const { repairs } = await this.scan();
    const batch = repairs.slice(0, limit);

    const outcomes: RepairOutcome[] = [];
    for (const item of batch) {
      try {
        const topics = await this.gateway.getTopics(this.config.org, item.ova.repoName);
        const fixed = await this.applyFixes(item.ova, topics, item.teamPermission);
        await this.recordRepair(item.ova, fixed, actor);
        outcomes.push({ repoName: item.ova.repoName, success: true, fixed });
      } catch (error) {
        outcomes.push({ repoName: item.ova.repoName, success: false, fixed: [], error: errorText(error) });
      }
    }
    return { outcomes, remaining: repairs.length - batch.length };
  }

  /** Registra un repositorio que ya existe en GitHub y lo deja como una OVA creada por la herramienta. */
  async adopt(input: {
    repoName: string;
    schoolId: number;
    developerId: number;
    actor: string;
  }): Promise<AdoptResult> {
    const existing = await this.registry.findByRepoName(input.repoName);
    if (existing) return { success: false, message: `OVA already registered: ${existing.repoName}` };

    const school = await this.catalog.findSchool(input.schoolId);
    const developer = await this.catalog.findDeveloper(input.developerId);
    if (!school || !developer) return { success: false, message: 'School or developer does not exist' };

    let repo;
    try {
      repo = await this.gateway.getRepository(this.config.org, input.repoName);
    } catch (error) {
      return { success: false, message: errorText(error) };
    }
    if (repo.isTemplate || repo.name.toLowerCase() === this.templateName()) {
      return { success: false, message: 'The template repository cannot be registered as an OVA' };
    }

    const ova = await this.registry.add({
      repoName: repo.name,
      repoUrl: repo.url,
      schoolId: school.id,
      developerId: developer.id,
      createdBy: input.actor,
    });

    // Ya está registrada: si falla lo de GitHub se avisa, pero no se deshace el registro
    const warnings: string[] = [];
    let fixed: string[] = [];
    try {
      const [topics, teamPermission] = await Promise.all([
        this.gateway.getTopics(this.config.org, ova.repoName),
        this.gateway.getTeamPermission(this.config.org, this.config.team.slug, ova.repoName),
      ]);
      fixed = await this.applyFixes(ova, topics, teamPermission);
    } catch (error) {
      warnings.push(
        `La OVA quedó registrada, pero no se pudo completar su configuración en GitHub: ${errorText(error)}`,
      );
    }

    try {
      await this.audit?.record({
        actor: input.actor,
        action: 'ova.adopted',
        repoName: ova.repoName,
        repoUrl: ova.repoUrl,
        details: { school: ova.school.name, developer: ova.developer.name, fixed },
      });
    } catch {
      warnings.push('La OVA se registró, pero no se pudo anotar en el registro de actividad.');
    }

    return { success: true, ova, fixed, warnings };
  }

  /** Añade lo que falta (topic y/o team). Devuelve qué se hizo. */
  private async applyFixes(
    ova: OvaRecord,
    topics: string[],
    teamPermission: TeamPermissionLevel | null,
  ): Promise<string[]> {
    const fixed: string[] = [];

    if (!topics.includes(ova.school.slug)) {
      await this.gateway.replaceTopics(this.config.org, ova.repoName, [...topics, ova.school.slug]);
      fixed.push(`topic "${ova.school.slug}"`);
    }

    if (teamPermission === null || this.isInsufficient(teamPermission)) {
      await this.gateway.assignTeam(
        this.config.org,
        ova.repoName,
        this.config.team.slug,
        this.config.team.permission,
      );
      fixed.push(
        teamPermission === null
          ? `team ${this.config.team.slug} (${this.config.team.permission})`
          : `permiso del team ${this.config.team.slug}: ${teamPermission} → ${this.config.team.permission}`,
      );
    }
    return fixed;
  }

  private isInsufficient(current: TeamPermissionLevel): boolean {
    return TEAM_PERMISSION_RANK[current] < TEAM_PERMISSION_RANK[this.config.team.permission];
  }

  private templateName(): string | null {
    return this.config.template ? repoPart(this.config.template) : null;
  }

  /** Anota la corrección solo si hubo algo que corregir; si falla el historial, ya se corrigió. */
  private async recordRepair(ova: OvaRecord, fixed: string[], actor: string): Promise<void> {
    if (fixed.length === 0) return;
    try {
      await this.audit?.record({
        actor,
        action: 'ova.repaired',
        repoName: ova.repoName,
        repoUrl: ova.repoUrl,
        details: { school: ova.school.name, developer: ova.developer.name, fixed },
      });
    } catch {
      // sin historial, pero GitHub ya quedó al día
    }
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}
