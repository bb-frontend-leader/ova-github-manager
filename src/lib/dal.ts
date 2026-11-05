import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { can, type Permission, type ProjectRecord, type Role } from '@/core';
import { auth } from '@/auth';
import { getProjectServices, getServices, type ProjectServices } from './services';

/**
 * Capa de acceso a datos (DAL): único lugar donde se decide quién es el usuario y qué puede hacer.
 * Se llama desde cada página y cada acción de servidor, junto a los datos que protege.
 *
 * Los roles son POR PROYECTO y salen de la base de datos, no del token. Los super administradores
 * (configuración INITIAL_ADMINS) son admin en todos los proyectos y son los únicos que los crean.
 */

export interface Viewer {
  login: string;
  superAdmin: boolean;
  /** Proyectos a los que puede entrar (todos, si es super administrador) */
  projects: ProjectRecord[];
}

/** Persona autenticada con acceso a la herramienta; null si no hay sesión o no tiene ningún proyecto. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  const login = session?.user?.login;
  if (!login) return null;

  const { signIn, store } = getServices();
  const superAdmin = signIn.isSuperAdmin(login);
  const projects = superAdmin ? await store.listProjects() : await store.listProjectsFor(login);
  if (!superAdmin && projects.length === 0) return null;

  return { login, superAdmin, projects };
}

export interface ProjectAccess {
  viewer: Viewer;
  login: string;
  /** Rol efectivo en este proyecto (los super administradores son admin) */
  role: Role;
  project: ProjectRecord;
  services: ProjectServices;
}

/** Acceso de la persona a un proyecto concreto; null si no puede entrar a él. */
export async function getProjectAccess(slug: string): Promise<ProjectAccess | null> {
  const viewer = await getViewer();
  if (!viewer) return null;

  const project = viewer.projects.find((p) => p.slug === slug);
  if (!project) return null;

  const services = getProjectServices(project);
  const role = viewer.superAdmin ? 'admin' : (await services.store.findUser(viewer.login))?.role;
  if (!role) return null;

  return { viewer, login: viewer.login, role, project, services };
}

/** Para páginas de la herramienta (fuera de un proyecto): sin sesión va al login. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/login');
  return viewer;
}

/** Para páginas de gestión de proyectos: solo super administradores. */
export async function requireSuperAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.superAdmin) redirect('/?denied=1');
  return viewer;
}

/** Para páginas de un proyecto: sin sesión va al login; sin acceso, 404; sin permiso vuelve al panel. */
export async function requireProjectPermission(
  slug: string,
  permission: Permission,
): Promise<ProjectAccess> {
  await requireViewer();
  const access = await getProjectAccess(slug);
  if (!access) notFound();
  if (!can(access.role, permission)) redirect(`/p/${access.project.slug}?denied=1`);
  return access;
}

export type ActionAuth<T> = { ok: true; value: T } | { ok: false; message: string };

/** Para acciones de servidor de un proyecto: devuelve un mensaje en vez de redirigir. */
export async function authorizeProjectAction(
  slug: string,
  permission: Permission,
): Promise<ActionAuth<ProjectAccess>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: 'Tu sesión expiró. Vuelve a iniciar sesión.' };

  const access = await getProjectAccess(slug);
  if (!access) return { ok: false, message: 'No tienes acceso a ese proyecto.' };
  if (!can(access.role, permission)) {
    return { ok: false, message: 'No tienes permiso para realizar esta acción.' };
  }
  return { ok: true, value: access };
}

/** Para acciones de servidor reservadas a super administradores. */
export async function authorizeSuperAdminAction(): Promise<ActionAuth<Viewer>> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, message: 'Tu sesión expiró. Vuelve a iniciar sesión.' };
  if (!viewer.superAdmin) {
    return { ok: false, message: 'Solo un super administrador puede gestionar proyectos.' };
  }
  return { ok: true, value: viewer };
}
