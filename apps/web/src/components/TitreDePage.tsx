import type { ReactNode } from 'react';
import { Pastille, type NomDePastille } from '@/components/Pastille';
import { cn } from '@/lib/cn';

/**
 * Le titre d'un écran du voyage, précédé de sa pastille.
 *
 * Les écrans internes au voyage — participants, itinéraire, dépenses, carte,
 * valise — s'atteignent depuis une grille où chacun est représenté par sa
 * pastille colorée. Arriver sur une page qui ne la reprend pas casse le fil :
 * on a tapé un carré vert « Dépenses » et on tombe sur un titre nu.
 *
 * La pastille ne porte aucune information à elle seule : le titre est toujours
 * écrit à côté, et le carré reste masqué aux lecteurs d'écran.
 */
export function TitreDePage({
  pastille,
  children,
  className,
}: {
  pastille: NomDePastille;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Pastille nom={pastille} />
      <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">{children}</h1>
    </div>
  );
}

/**
 * Le même repère, en petit, pour une section à l'intérieur d'un écran.
 *
 * Certaines fonctions de la planche — la météo, les hébergements, le
 * transport, le vote — ne sont pas des écrans mais des blocs de l'aperçu.
 * Elles ont pourtant leur pastille, et la montrer ici évite qu'une icône
 * dessinée pour l'application ne s'affiche nulle part.
 */
export function TitreDeSection({
  pastille,
  children,
  niveau = 'h2',
  className,
}: {
  pastille: NomDePastille;
  children: ReactNode;
  /** `h2` par défaut ; `h3` quand la section est imbriquée dans une autre. */
  niveau?: 'h2' | 'h3';
  className?: string;
}) {
  const Titre = niveau;
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Pastille nom={pastille} taille="sm" />
      <Titre className="min-w-0 text-sm font-bold">{children}</Titre>
    </div>
  );
}
