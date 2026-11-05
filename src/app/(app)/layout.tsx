import type { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { can } from '@/core';
import { signOut } from '@/auth';
import { BrandMark } from '@/components/brand';
import { InitialsAvatar } from '@/components/initials-avatar';
import { MainNav, type NavItem } from '@/components/main-nav';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requirePagePermission } from '@/lib/dal';

const ROLE_LABELS = { viewer: 'Lector', creator: 'Creador', admin: 'Admin' } as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requirePagePermission('ova:view');

  const items: NavItem[] = [{ href: '/', label: 'Panel', icon: 'panel' }];
  if (can(user.role, 'ova:create')) items.push({ href: '/ovas/new', label: 'Crear OVA', icon: 'crear' });
  items.push({ href: '/activity', label: 'Actividad', icon: 'actividad' });
  if (can(user.role, 'users:manage')) items.push({ href: '/admin', label: 'Administración', icon: 'admin' });

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
          <div className="ml-2 md:ml-6">
            <MainNav items={items} />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-1.5">
              <InitialsAvatar name={user.login} />
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-medium">@{user.login}</span>
                <Badge variant="secondary" className="w-fit">
                  {ROLE_LABELS[user.role]}
                </Badge>
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
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Proyecto 625-OVAS-2027
      </footer>
    </div>
  );
}
