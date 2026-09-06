import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { CloudOff, Compass, Map, User, Wallet } from 'lucide-react';
import { useEnLigne } from '@/lib/useEnLigne';
import { cn } from '@/lib/cn';

interface Tab {
  to: string;
  label: string;
  icon: typeof Compass;
}

/**
 * Navigation principale en bas d'écran : c'est la seule zone réellement
 * atteignable au pouce sur un grand téléphone. Quatre entrées maximum, sinon
 * les cibles deviennent trop étroites.
 */
const TABS: Tab[] = [
  { to: '/voyages', label: 'Voyages', icon: Compass },
  { to: '/carte', label: 'Carte', icon: Map },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/profil', label: 'Profil', icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const enLigne = useEnLigne();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      {/*
        Un bandeau plutôt qu'un écran d'erreur : hors réseau, Tripora affiche
        ce qu'il sait déjà du voyage, et c'est utilisable. Ce qui manque, c'est
        la fraîcheur — il faut le dire, pas bloquer.
      */}
      {!enLigne && (
        <p
          role="status"
          className="bg-gold-500/15 text-gold-800 dark:text-gold-200 flex items-center
                     justify-center gap-2 px-4 py-2 text-xs font-medium"
        >
          <CloudOff className="size-3.5 shrink-0" aria-hidden />
          Hors réseau — vous voyez la dernière version connue de vos voyages.
        </p>
      )}

      <main className="flex-1 pb-24">{children}</main>

      <nav
        aria-label="Navigation principale"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl
                   border-t border-[color:var(--border-subtle)]
                   bg-[color:var(--surface)]/85 px-2 pt-1.5 backdrop-blur-xl"
      >
        <ul className="flex items-stretch justify-around">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(`${to}/`);
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5',
                    'text-[0.7rem] font-medium transition-colors',
                    active ? 'text-brand-500' : 'text-muted',
                  )}
                >
                  <Icon className={cn('size-5', active && 'scale-110')} aria-hidden />
                  {label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** En-tête d'écran, avec un titre lisible d'un coup d'œil. */
export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-4">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
