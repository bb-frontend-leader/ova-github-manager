import { School } from './School';

/** Datos de un proyecto de OVAs ya validados y normalizados. */
export interface ProjectDetails {
  /** Identificador en la URL: minúsculas, números y guiones. No cambia después */
  slug: string;
  /** Nombre para mostrar, p. ej. "625 OVAs 2027" */
  name: string;
  /** Organización de GitHub donde viven los repositorios. No cambia después */
  org: string;
  /** Repositorio plantilla (o "owner/repo") desde el que se crea cada OVA */
  template: string;
  /** Team de GitHub que recibe permiso de lectura sobre cada repositorio */
  defaultTeam: string;
  /** Prefijo de la descripción de cada repositorio */
  descriptionPrefix: string;
  /** Cuántas OVAs tiene que llegar a tener el proyecto */
  total: number;
}

export interface ProjectInput {
  name: string;
  org: string;
  slug?: string;
  template?: string;
  defaultTeam?: string;
  descriptionPrefix?: string;
  total: number | string;
}

const MAX_NAME = 80;
const MAX_SLUG = 50;
const MAX_TOTAL = 100_000;
// Reglas de GitHub: letras, números y guiones sueltos; sin guion al inicio o al final; hasta 39
const ORG_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Rutas de la aplicación que un proyecto no puede ocupar como slug
const RESERVED_SLUGS = new Set(['new', 'api', 'login', 'projects', 'p']);

function required(value: string | undefined, label: string, max: number): string {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (text.length === 0) throw new Error(`${label} cannot be empty`);
  if (text.length > max) throw new Error(`${label} cannot exceed ${max} characters`);
  return text;
}

/** Reglas de negocio de un proyecto: qué es válido y cómo se normaliza. */
export class Project {
  private constructor() {}

  static validate(input: ProjectInput): ProjectDetails {
    const name = required(input.name, 'Project name', MAX_NAME);

    const org = (input.org ?? '').trim();
    if (org.length === 0) throw new Error('Organization cannot be empty');
    if (!ORG_PATTERN.test(org)) throw new Error(`Invalid GitHub organization: ${org}`);

    const slug = (input.slug?.trim() ? input.slug.trim() : School.toSlug(name)).toLowerCase();
    if (!SLUG_PATTERN.test(slug) || slug.length > MAX_SLUG) {
      throw new Error(`Invalid project identifier: ${slug || '(empty)'}`);
    }
    if (RESERVED_SLUGS.has(slug)) throw new Error(`Project identifier is reserved: ${slug}`);

    const total = Number(input.total);
    if (!Number.isInteger(total) || total < 1 || total > MAX_TOTAL) {
      throw new Error(`Project total must be a whole number between 1 and ${MAX_TOTAL}`);
    }

    return {
      slug,
      name,
      org,
      template: required(input.template ?? 'ova-template', 'Template', 140),
      defaultTeam: required(input.defaultTeam ?? 'Frontend', 'Team', 100),
      descriptionPrefix: required(input.descriptionPrefix ?? name, 'Description prefix', 100),
      total,
    };
  }
}
