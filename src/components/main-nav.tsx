'use client';

import { History, LayoutDashboard, CirclePlus, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ICONS = { panel: LayoutDashboard, crear: CirclePlus, actividad: History, admin: Settings2 } as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

/** Navegación principal. Recibe solo los enlaces permitidos al rol (se decide en el servidor). */
export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex items-center gap-1">
      {items.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
