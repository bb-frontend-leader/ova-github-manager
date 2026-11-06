'use client';

import {
  CirclePlus,
  Columns3,
  History,
  LayoutDashboard,
  Scale,
  Settings2,
  SlidersHorizontal,
  UserRound,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const ICONS = {
  panel: LayoutDashboard,
  tablero: Columns3,
  trabajo: UserRound,
  carga: Scale,
  reparar: Wrench,
  crear: CirclePlus,
  actividad: History,
  admin: Settings2,
  proyecto: SlidersHorizontal,
} as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  /** Solo está activo en esa ruta exacta (el panel del proyecto cuelga de todas las demás) */
  exact?: boolean;
}

/** Navegación del proyecto. Recibe solo los enlaces permitidos al rol (se decide en el servidor). */
export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Proyecto" className="flex items-center gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
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
