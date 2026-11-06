import 'server-only';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  ChangeOvaStatusUseCase,
  CreateOvaUseCase,
  CreateRepositoryUseCase,
  ManageCatalogUseCase,
  ManageProjectsUseCase,
  ManageUsersUseCase,
  OctokitRepositoryGateway,
  OvaHealthUseCase,
  Project,
  ReconcileOvasUseCase,
  SignInUseCase,
  SqliteOvaStore,
  SyncOvasUseCase,
  UpdateOvaUseCase,
  type ProjectDetails,
  type ProjectRecord,
  type SqliteProjectStore,
} from '@/core';
import { getEnv } from './env';
import { cachedInspector } from './health';

/** Servicios de toda la herramienta: proyectos y acceso. */
export interface Services {
  store: SqliteOvaStore;
  gateway: OctokitRepositoryGateway;
  signIn: SignInUseCase;
  manageProjects: ManageProjectsUseCase;
}

/** Servicios de UN proyecto: todo lo que hacen está acotado a su organización y a sus datos. */
export interface ProjectServices {
  project: ProjectRecord;
  store: SqliteProjectStore;
  manageUsers: ManageUsersUseCase;
  manageCatalog: ManageCatalogUseCase;
  createOva: CreateOvaUseCase;
  syncOvas: SyncOvasUseCase;
  updateOva: UpdateOvaUseCase;
  changeStatus: ChangeOvaStatusUseCase;
  reconcile: ReconcileOvasUseCase;
  health: OvaHealthUseCase;
}

// En desarrollo, el hot reload recarga los módulos: se guarda en globalThis para no
// abrir una conexión a SQLite nueva en cada recarga.
const globalForServices = globalThis as unknown as {
  __ovaServices?: Services;
  __ovaServicesVersion?: number;
};

/** Súbelo cada vez que cambie la forma de `Services`, para invalidar la caché de desarrollo. */
const SERVICES_VERSION = 6;

export function getServices(): Services {
  const cached = globalForServices.__ovaServices;
  // En desarrollo la caché puede venir de una versión anterior del código (sin los servicios
  // nuevos). Si la versión no coincide, se cierra esa conexión y se reconstruye todo.
  const stale = cached !== undefined && globalForServices.__ovaServicesVersion !== SERVICES_VERSION;
  if (!cached || stale) {
    if (stale) cached.store.close();
    globalForServices.__ovaServices = buildServices();
    globalForServices.__ovaServicesVersion = SERVICES_VERSION;
  }
  return globalForServices.__ovaServices as Services;
}

/** Proyecto de una base de la versión anterior, tomado de la configuración que usaba entonces. */
function legacyProject(): ProjectDetails | undefined {
  const env = getEnv();
  if (!env.GITHUB_ORG) return undefined;
  return Project.validate({
    name: env.OVA_DESCRIPTION_PREFIX,
    org: env.GITHUB_ORG,
    template: env.OVA_TEMPLATE,
    defaultTeam: env.OVA_DEFAULT_TEAM,
    descriptionPrefix: env.OVA_DESCRIPTION_PREFIX,
    total: env.OVA_TOTAL,
  });
}

function buildServices(): Services {
  const env = getEnv();

  const databasePath = resolve(env.DATABASE_PATH);
  mkdirSync(dirname(databasePath), { recursive: true });
  const store = new SqliteOvaStore(databasePath, { legacyProject: legacyProject() });

  // Un solo token sirve para todas las organizaciones (debe tener acceso a cada una)
  const gateway = new OctokitRepositoryGateway(env.GITHUB_TOKEN);

  return {
    store,
    gateway,
    signIn: new SignInUseCase(store, { superAdmins: env.INITIAL_ADMINS }),
    manageProjects: new ManageProjectsUseCase(store, gateway),
  };
}

/**
 * Arma los casos de uso de un proyecto con su organización, plantilla, team y datos.
 * Es barato (solo objetos), así que se arma en cada petición y los cambios de configuración
 * del proyecto se notan de inmediato.
 */
export function getProjectServices(project: ProjectRecord): ProjectServices {
  const { store: root, gateway } = getServices();
  const store = root.forProject(project.id);

  // Permiso con el que se asigna el team a cada OVA ("write" en la interfaz de GitHub)
  const team = { slug: project.defaultTeam, permission: 'push' } as const;

  const createRepository = new CreateRepositoryUseCase(gateway, {
    org: project.org,
    descriptionPrefix: project.descriptionPrefix,
    defaultTeam: team,
  });

  // El almacén del proyecto hace de registro, catálogo, usuarios y registro de actividad
  const syncOvas = new SyncOvasUseCase(gateway, store, { org: project.org }, store);

  return {
    project,
    store,
    syncOvas,
    updateOva: new UpdateOvaUseCase(gateway, store, store, { org: project.org }, store),
    changeStatus: new ChangeOvaStatusUseCase(store, store),
    reconcile: new ReconcileOvasUseCase(
      gateway,
      store,
      store,
      { org: project.org, template: project.template, team },
      store,
    ),
    health: new OvaHealthUseCase(cachedInspector(gateway), store, { org: project.org }),
    manageUsers: new ManageUsersUseCase(store),
    manageCatalog: new ManageCatalogUseCase(store),
    createOva: new CreateOvaUseCase(
      createRepository,
      store,
      store,
      { template: project.template },
      syncOvas,
      store,
    ),
  };
}
