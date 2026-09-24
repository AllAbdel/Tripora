import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { CloudOff, Plus } from 'lucide-react';
import type { SVGProps } from 'react';
import { GlypheCarte, GlypheDepenses, GlypheProfil, GlypheVoyages } from '@/components/PageGlyphs';
import { Pastille, type NomDePastille } from '@/components/Pastille';
import { Logo } from '@/components/Logo';
import { ecranSansOnglets, ongletActif, sectionsDuVoyage, voyageDeLAdresse } from '@/lib/onglets';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { useEnLigne } from '@/lib/useEnLigne';
import { useEcranLarge } from '@/lib/useEcranLarge';
import { useClavierOuvert } from '@/lib/useClavierOuvert';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import type { CleDeTexte } from '@/i18n/textes';

interface Tab {
  to: string;
  /** La clé de traduction, pas le texte : la barre change de langue. */
  cle: CleDeTexte;
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
  { to: '/voyages', cle: 'nav.trips', icon: GlypheVoyages },
  { to: '/carte', cle: 'nav.carte', icon: GlypheCarte },
  { to: '/budget', cle: 'nav.budget', icon: GlypheDepenses },
  { to: '/profil', cle: 'nav.profil', icon: GlypheProfil },
];

/**
 * Deux mises en page, selon l'écran.
 *
 * Sur un téléphone ou une tablette, les onglets en bas : c'est là que le pouce
 * arrive. Sur un ordinateur, cette barre n'a plus de raison d'être — on vise à
 * la souris, et une colonne de téléphone perdue au milieu d'un écran large
 * gaspillait les deux tiers de la place. À partir de `lg` (1 024 px), la
 * navigation passe dans une barre latérale, et le contenu s'élargit.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const enLigne = useEnLigne();
  const ecranLarge = useEcranLarge();
  const clavierOuvert = useClavierOuvert();
  const t = useT();
  // Les onglets du bas : ni sur un ordinateur (la barre latérale les
  // remplace), ni dans la discussion ou « Découvrir » (leurs commandes
  // occupent le bas), ni pendant qu'on écrit (le clavier les ferait remonter
  // sur le champ).
  const onglets = !ecranLarge && !clavierOuvert && !ecranSansOnglets(pathname);

  return (
    <div className="min-h-dvh lg:flex">
      {ecranLarge && <BarreLaterale pathname={pathname} />}
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col lg:mx-0 lg:max-w-none lg:min-w-0 lg:flex-1">
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
            {t('etat.horsreseau')}
          </p>
        )}

        {/* La clé force React à remonter le contenu à chaque changement d'écran :
            sans elle, l'animation d'entrée ne rejouerait qu'une fois. Un fondu
            court et vertical, jamais un glissement latéral — un déplacement
            horizontal raconte un sens de navigation que l'application n'a pas. */}
        <main
          key={pathname}
          className="animate-page flex-1 pb-24 lg:mx-auto lg:w-full lg:max-w-4xl lg:px-6 lg:pb-12 print:pb-0"
        >
          {children}
        </main>

        {onglets && (
          <nav
            aria-label="Navigation principale"
            className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-2xl lg:hidden print:hidden
                       border-t border-[color:var(--border-subtle)]
                       bg-[color:var(--surface)]/85 px-2 pt-1.5 backdrop-blur-xl"
          >
            <ul className="flex items-stretch justify-around">
              {TABS.map(({ to, cle, icon: Icon }) => {
                const active = ongletActif(to, pathname);
                return (
                  <li key={to} className="flex-1">
                    <NavLink
                      to={to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative flex min-h-12 flex-col items-center justify-center gap-1 py-1.5',
                        'text-[0.6875rem] tracking-[0.06em] uppercase transition-colors',
                        active
                          ? 'text-brand-600 dark:text-brand-300 font-semibold'
                          : 'text-muted font-medium',
                      )}
                    >
                      {/* L'onglet actif se signale par un filet posé au-dessus,
                          pas seulement par une couleur. Un trait se voit sans
                          distinguer les teintes, et il appartient à la même
                          grammaire que le reste de la page. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-x-4 top-0 h-px transition-opacity',
                          active ? 'bg-current opacity-100' : 'opacity-0',
                        )}
                      />
                      <Icon className="size-5" aria-hidden />
                      {t(cle)}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}

/**
 * La navigation d'un grand écran : une colonne à gauche, toujours visible.
 *
 * En haut, les quatre destinations de toujours — les mêmes que les onglets du
 * téléphone, dans le même ordre. Dessous, quand un voyage est ouvert, tous ses
 * écrans : sur un ordinateur on passe de l'itinéraire aux dépenses d'un clic,
 * sans remonter à l'aperçu à chaque fois.
 */
function BarreLaterale({ pathname }: { pathname: string }) {
  const t = useT();
  const idVoyage = voyageDeLAdresse(pathname);
  // Même clé que l'aperçu : le voyage vient du cache, sans nouvelle requête.
  const voyage = useQuery({
    queryKey: cleVoyage(idVoyage ?? undefined),
    queryFn: () => getTripRepository().get(idVoyage!),
    enabled: Boolean(idVoyage),
  });
  const sections = idVoyage
    ? sectionsDuVoyage(idVoyage, Boolean(voyage.data?.lockedDestinationId))
    : [];

  return (
    <aside
      className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto
                 border-r border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-4 py-6
                 lg:flex print:hidden"
    >
      <Link to="/voyages" className="flex items-center gap-2.5 px-2">
        <Logo className="size-8" />
        <span className="titre-lieu text-2xl leading-none">Tripora</span>
      </Link>

      <Link
        to="/voyages/nouveau"
        className="bg-brand-600 hover:bg-brand-700 flex items-center justify-center gap-2 rounded-xl
                   px-3 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-colors"
      >
        <Plus className="size-4" aria-hidden />
        Nouveau trip
      </Link>

      <nav aria-label="Navigation principale">
        <ul className="space-y-0.5">
          {TABS.map(({ to, cle, icon: Icon }) => {
            const active = ongletActif(to, pathname);
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold'
                      : 'text-muted hover:bg-[color:var(--surface-muted)] font-medium',
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {t(cle)}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {idVoyage && (
        <nav aria-label="Écrans du voyage" className="space-y-2">
          <div className="px-3">
            <p className="etiquette">Ce voyage</p>
            <p className="mt-1 truncate text-sm font-semibold">
              {voyage.data?.summary.title ?? '…'}
            </p>
          </div>
          <ul className="space-y-0.5">
            {sections.map(({ to, titre, pastille }) => {
              const active = pathname === to;
              return (
                <li key={to}>
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-brand-500/10 text-brand-700 dark:text-brand-200 font-semibold'
                        : 'hover:bg-[color:var(--surface-muted)]',
                    )}
                  >
                    <Pastille nom={pastille} taille="xs" />
                    {titre}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </aside>
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
