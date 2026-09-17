import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { CloudOff } from 'lucide-react';
import type { SVGProps } from 'react';
import { GlypheCarte, GlypheDepenses, GlypheProfil, GlypheVoyages } from '@/components/PageGlyphs';
import { Pastille, type NomDePastille } from '@/components/Pastille';
import { ongletActif } from '@/lib/onglets';
import { useEnLigne } from '@/lib/useEnLigne';
import { cn } from '@/lib/cn';

interface Tab {
  to: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
}

/**
 * Navigation principale en bas d'écran : c'est la seule zone réellement
 * atteignable au pouce sur un grand téléphone. Quatre entrées maximum, sinon
 * les cibles deviennent trop étroites.
 */
// Les mêmes pictogrammes que sur la planche d'icônes — la valise, la carte
// pliée, la pile de pièces, le profil — plutôt que des pictogrammes de
// bibliothèque proches mais différents. Ici au trait fin d'une barre
// d'onglets, sans le fond dégradé des grandes tuiles : un dégradé par onglet
// alourdirait une barre large de quatre cases.
const TABS: Tab[] = [
  { to: '/voyages', label: 'Voyages', icon: GlypheVoyages },
  { to: '/carte', label: 'Carte', icon: GlypheCarte },
  { to: '/budget', label: 'Budget', icon: GlypheDepenses },
  { to: '/profil', label: 'Profil', icon: GlypheProfil },
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

      {/* La clé force React à remonter le contenu à chaque changement d'écran :
          sans elle, l'animation d'entrée ne rejouerait qu'une fois. Un fondu
          court et vertical, jamais un glissement latéral — un déplacement
          horizontal raconte un sens de navigation que l'application n'a pas. */}
      <main key={pathname} className="animate-page flex-1 pb-24 print:pb-0">
        {children}
      </main>

      <nav
        aria-label="Navigation principale"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl
                   border-t border-[color:var(--border-subtle)]
                   bg-[color:var(--surface)]/85 px-2 pt-1.5 backdrop-blur-xl"
      >
        <ul className="flex items-stretch justify-around">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = ongletActif(to, pathname);
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

/**
 * En-tête d'écran, avec un titre lisible d'un coup d'œil.
 *
 * La pastille à gauche du titre est celle de la planche d'icônes : la maison
 * pour l'accueil, la valise pour les voyages, la carte pliée pour la carte.
 * C'est le même repère que dans la grille du voyage, donc on retrouve l'écran
 * où on vient d'arriver sans lire le titre — utile quand on navigue vite.
 */
export function ScreenHeader({
  title,
  subtitle,
  action,
  pastille,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  pastille?: NomDePastille;
}) {
  return (
    <header className="flex items-start justify-between gap-4 px-5 pt-6 pb-4">
      <div className="flex min-w-0 items-center gap-3">
        {pastille && <Pastille nom={pastille} />}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
