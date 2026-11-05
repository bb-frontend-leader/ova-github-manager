import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { signOut } from '@/auth';
import { BrandMark } from '@/components/brand';
import { InitialsAvatar } from '@/components/initials-avatar';
import { ProjectSwitcher } from '@/components/project-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireViewer } from '@/lib/dal';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg font-semibold tracking-tight">
            <BrandMark />
            <span className="max-md:sr-only">OVA GitHub Manager</span>
          </Link>
          {viewer.projects.length > 0 && (
            <div className="ml-1 md:ml-4">
              <ProjectSwitcher
                projects={viewer.projects.map((p) => ({ slug: p.slug, name: p.name }))}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-1.5">
              <InitialsAvatar name={viewer.login} />
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-medium">@{viewer.login}</span>
                {viewer.superAdmin && (
                  <Badge variant="default" className="w-fit">
                    Super admin
                  </Badge>
                )}
              </div>
            </div>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <Button type="submit" variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión">
                <LogOut aria-hidden />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none">
        {children}
      </main>
    </div>
  );
}
