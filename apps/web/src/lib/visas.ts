import { useEffect, useState } from 'react';
import type { ExigenceDeVisa } from '@tripora/core/visas';

/**
 * Faut-il un visa ? La réponse pour un passeport du pays de départ.
 *
 * Le tableau des visas pèse une quinzaine de kilo-octets : il n'est chargé
 * qu'à l'ouverture des infos pratiques. En attendant — un instant, puis plus
 * jamais grâce au cache du service worker — la ligne ne s'affiche pas, et
 * elle ne s'affiche pas non plus quand la source ne sait rien (même pays,
 * territoire d'outre-mer, passeport inconnu) : rien n'est deviné.
 */

export interface ReponseDeVisa {
  exigence: ExigenceDeVisa;
  releve: string;
}

export function useFormaliteDEntree(passeport: string | undefined, destination: string): ReponseDeVisa | null {
  const cle = `${passeport ?? ''}>${destination}`;
  // La réponse garde la paire qu'elle concerne : changer de destination
  // n'affiche jamais, le temps d'un rendu, le visa de la précédente.
  const [lue, setLue] = useState<{ cle: string; reponse: ReponseDeVisa | null } | null>(null);
  useEffect(() => {
    if (!passeport) return;
    let actif = true;
    import('@tripora/core/visas')
      .then(({ exigenceDeVisa, RELEVE_DES_VISAS }) => {
        const exigence = exigenceDeVisa(passeport, destination);
        if (actif) setLue({ cle, reponse: exigence ? { exigence, releve: RELEVE_DES_VISAS } : null });
      })
      // Hors ligne avant d'avoir jamais chargé le tableau : la ligne se tait.
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [cle, passeport, destination]);
  return lue?.cle === cle ? lue.reponse : null;
}

export function phraseDeVisa({ formalite, jours }: ExigenceDeVisa): string {
  switch (formalite) {
    case 'sans-visa':
      return jours ? `Sans visa, jusqu’à ${jours} jours.` : 'Sans visa.';
    case 'visa-a-l-arrivee':
      return jours ? `Visa délivré à l’arrivée, pour ${jours} jours.` : 'Visa délivré à l’arrivée.';
    case 'autorisation-electronique':
      return 'Autorisation électronique à demander en ligne avant le départ (comme l’ESTA américain).';
    case 'visa-electronique':
      return 'Visa électronique à demander en ligne avant le départ.';
    case 'visa':
      return 'Visa à demander avant le départ, auprès du consulat.';
    case 'entree-refusee':
      return 'Entrée actuellement refusée avec ce passeport.';
  }
}
