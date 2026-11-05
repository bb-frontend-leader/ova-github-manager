import 'server-only';
import { z } from 'zod';

const EnvSchema = z.object({
  GITHUB_ORG: z.string().min(1, 'GITHUB_ORG es obligatorio'),
  // Fase actual: token personal. Se sustituirá por una GitHub App (ver README).
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN es obligatorio'),
  /** Usuarios de GitHub que siempre son admin (separados por comas). Arranque y recuperación. */
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
  OVA_DESCRIPTION_PREFIX: z.string().min(1).default('625 OVAs 2027'),
  OVA_DEFAULT_TEAM: z.string().min(1).default('Frontend'),
  /** Repositorio plantilla de la organización desde el que se crea cada OVA */
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
