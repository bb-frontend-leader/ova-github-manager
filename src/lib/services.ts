import 'server-only';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  CreateOvaUseCase,
  CreateRepositoryUseCase,
  ManageCatalogUseCase,
  ManageUsersUseCase,
  OctokitRepositoryGateway,
  SignInUseCase,
  SqliteOvaStore,
  SyncOvasUseCase,
  UpdateOvaUseCase,
} from '@/core';
import { getEnv } from './env';

export interface Services {
  store: SqliteOvaStore;
  signIn: SignInUseCase;
  manageUsers: ManageUsersUseCase;
  manageCatalog: ManageCatalogUseCase;
  createOva: CreateOvaUseCase;
  syncOvas: SyncOvasUseCase;
  updateOva: UpdateOvaUseCase;
}

// En desarrollo, el hot reload recarga los módulos: se guarda en globalThis para no
// abrir una conexión a SQLite nueva en cada recarga.
const globalForServices = globalThis as unknown as {
  __ovaServices?: Services;
  __ovaServicesVersion?: number;
};

/** Súbelo cada vez que cambie la forma de `Services`, para invalidar la caché de desarrollo. */
const SERVICES_VERSION = 3;

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

function buildServices(): Services {
  const env = getEnv();

  const databasePath = resolve(env.DATABASE_PATH);
  mkdirSync(dirname(databasePath), { recursive: true });
  const store = new SqliteOvaStore(databasePath);

  const gateway = new OctokitRepositoryGateway(env.GITHUB_TOKEN);
  const createRepository = new CreateRepositoryUseCase(gateway, {
    org: env.GITHUB_ORG,
    descriptionPrefix: env.OVA_DESCRIPTION_PREFIX,
    defaultTeam: { slug: env.OVA_DEFAULT_TEAM, permission: 'pull' },
  });

  // El mismo almacén SQLite hace de registro, catálogo, usuarios y registro de actividad
  const syncOvas = new SyncOvasUseCase(gateway, store, { org: env.GITHUB_ORG }, store);

  return {
    store,
    syncOvas,
    updateOva: new UpdateOvaUseCase(gateway, store, store, { org: env.GITHUB_ORG }, store),
    signIn: new SignInUseCase(store, { initialAdmins: env.INITIAL_ADMINS }),
    manageUsers: new ManageUsersUseCase(store),
    manageCatalog: new ManageCatalogUseCase(store),
    createOva: new CreateOvaUseCase(
      createRepository,
      store,
      store,
      { template: env.OVA_TEMPLATE },
      syncOvas,
      store,
    ),
  };
}
