import type { ReactNode } from 'react';

/** Un écran vide doit expliquer quoi faire, pas se contenter d'être vide. */
export function EmptyState({
  illustration,
  title,
  description,
  action,
  /**
   * Le niveau du titre.
   *
   * Deux par défaut : un état vide s'insère presque toujours sous le titre
   * d'un écran qui existe déjà. Quand il occupe la page entière — « Page
   * introuvable » — il en est le titre, et une page qui commence au niveau
   * deux se parcourt mal au lecteur d'écran.
   */
  niveauDuTitre = 2,
}: {
  illustration?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  niveauDuTitre?: 1 | 2;
}) {
  const Titre = niveauDuTitre === 1 ? 'h1' : 'h2';
  return (
    <div className="animate-rise flex flex-col items-center gap-4 px-6 py-14 text-center">
      {illustration}
      <div className="space-y-1.5">
        <Titre className="text-lg font-semibold">{title}</Titre>
        <p className="text-muted mx-auto max-w-sm text-sm leading-relaxed">{description}</p>
      </div>
      {action}
    </div>
  );
}
