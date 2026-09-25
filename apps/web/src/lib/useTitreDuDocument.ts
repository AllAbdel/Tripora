import { useEffect } from 'react';

const TITRE_PAR_DEFAUT = 'Tripora — organisez un voyage entre amis';

/**
 * Le titre de l'onglet, page par page.
 *
 * Les pages publiques de l'application — accueil, mentions légales,
 * conditions — sont lues par les moteurs de recherche, qui affichent ce titre
 * dans leurs résultats. Toutes portaient celui de l'accueil.
 */
export function useTitreDuDocument(titre: string | null): void {
  useEffect(() => {
    if (!titre) return;
    document.title = titre;
    return () => {
      document.title = TITRE_PAR_DEFAUT;
    };
  }, [titre]);
}
