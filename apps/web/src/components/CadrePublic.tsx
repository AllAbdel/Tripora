import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '@/components/Logo';
import { PiedDePage } from '@/components/PiedDePage';
import { cn } from '@/lib/cn';

/**
 * Le cadre des pages qu'on lit sans compte : l'accueil, les pages légales.
 *
 * Une barre simple — la marque à gauche, « Se connecter » à droite — et le
 * pied de page. Pas d'onglets : ils mèneraient tous à la connexion, et une
 * navigation dont chaque entrée est une porte fermée donne l'impression
 * d'être refoulé.
 */
export function CadrePublic({
  children,
  connexion = true,
  large = false,
  pied = 'complet',
}: {
  children: ReactNode;
  /** L'écran de connexion n'a pas besoin du plan du site sous ses boutons. */
  pied?: 'complet' | 'discret';
  /** Le bouton « Se connecter » de la barre. Inutile sur la page de connexion. */
  connexion?: boolean;
  /** L'accueil prend toute la largeur ; une page de texte, une colonne. */
  large?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="bg-[color:var(--surface)]/85 filet sticky top-0 z-30 border-b backdrop-blur-xl print:hidden"
      >
        <div
          className={cn(
            'mx-auto flex h-14 w-full items-center justify-between gap-3 px-5',
            large ? 'max-w-5xl' : 'max-w-2xl',
          )}
        >
          <Link to="/" className="flex items-center gap-2" aria-label="Tripora, accueil">
            <Logo className="size-8" />
            <span className="titre-lieu text-xl leading-none">Tripora</span>
          </Link>
          {connexion && (
            <Link
              to="/connexion"
              className="text-brand-700 dark:text-brand-200 hover:bg-brand-500/10 inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors"
            >
              Se connecter
            </Link>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <PiedDePage variante={pied} />
    </div>
  );
}
