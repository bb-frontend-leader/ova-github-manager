import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { Alert } from '@/components/alert';
import { BrandMark } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { withBasePath } from '@/lib/base-path';
import { getViewer } from '@/lib/dal';

const ERROR_MESSAGES: Record<string, { title: string; hint: string }> = {
  NotOrgMember: {
    title: 'Tu cuenta no pertenece a ninguna organización de la herramienta',
    hint: 'Pide que te inviten a la organización de tu proyecto en GitHub y vuelve a intentarlo.',
  },
  AccessDenied: {
    title: 'No pudimos verificar tu pertenencia a la organización',
    hint: 'Inténtalo de nuevo. Si el problema sigue, avisa a un administrador.',
  },
};

function GithubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Se valida contra la base de datos (no solo la cookie) para evitar un bucle de redirecciones
  if (await getViewer()) redirect('/');

  const { error } = await searchParams;
  const message = error
    ? (ERROR_MESSAGES[error] ?? {
        title: 'No se pudo iniciar sesión',
        hint: 'Inténtalo de nuevo en unos segundos.',
      })
    : null;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span className="inline-flex size-9 items-center justify-center rounded-lg bg-white/15">
            <BrandMark className="bg-transparent shadow-none" />
          </span>
          OVA GitHub Manager
        </div>
        <div className="relative max-w-md">
          <p className="text-4xl font-semibold tracking-tight text-balance">
            Tus OVAs, un repositorio a la vez.
          </p>
          <p className="mt-4 text-base text-primary-foreground/85">
            Crea cada repositorio desde la plantilla, asígnalo a su equipo y deja el registro al día
            sin salir de aquí.
          </p>
        </div>
        <p className="relative text-sm text-primary-foreground/75">Varios proyectos, una sola herramienta</p>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-10">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center gap-3 lg:hidden">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight">OVA GitHub Manager</span>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Usa tu cuenta de GitHub. Entran los miembros de las organizaciones de los proyectos.
            </p>
          </div>

          {message && (
            <Alert variant="error" title={message.title}>
              {message.hint}
            </Alert>
          )}

          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: withBasePath('/') });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              <GithubMark className="size-4" /> Entrar con GitHub
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
