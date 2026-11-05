import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  // Un solo token para todas las organizaciones. Fase actual: token personal; se sustituirá por
  // una GitHub App (ver README).
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN es obligatorio'),
  /**
   * Super administradores (separados por comas): crean proyectos y son admin en todos.
   * Arranque y recuperación de acceso.
   */
  INITIAL_ADMINS: z
    .string()
    .min(1, 'INITIAL_ADMINS es obligatorio (al menos un usuario de GitHub)')
    .transform((value) =>
      value
        .split(',')
        .map((login) => login.trim())
        .filter(Boolean),
    ),
  DATABASE_PATH: z.string().min(1).default('./data/ova.db'),
  /**
   * Solo para migrar una base de la versión de un solo proyecto: si existe, esos valores pasan a
   * ser el primer proyecto. Después los proyectos se gestionan desde la interfaz y estas variables
   * ya no se usan.
   */
  GITHUB_ORG: z.string().min(1).optional(),
  OVA_DESCRIPTION_PREFIX: z.string().min(1).default('625 OVAs 2027'),
  OVA_DEFAULT_TEAM: z.string().min(1).default('Frontend'),
  OVA_TEMPLATE: z.string().min(1).default('ova-template'),
  OVA_TOTAL: z.coerce.number().int().positive().default(625),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Se valida al primer uso (no al compilar) para que `next build` no exija secretos. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = EnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw new Error(`Configuración inválida: ${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}
