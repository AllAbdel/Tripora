import { useEffect, useState } from 'react';
import type { ExigenceDeVisa } from '@tripora/core/visas';

/**
 * Faut-il un visa ? La réponse pour les passeports déclarés dans le profil,
 * ou, à défaut, pour un passeport du pays de départ.
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
  /**
   * Le passeport déclaré qui donne la réponse ; `null` quand elle vaut pour
   * un passeport du pays de départ, faute de passeport déclaré.
   */
  passeport: string | null;
}

export function useFormaliteDEntree(
  paysDeDepart: string | undefined,
  destination: string,
  declares: readonly string[] = [],
): ReponseDeVisa | null {
  const passeports = declares.length > 0 ? declares : paysDeDepart ? [paysDeDepart] : [];
  const cle = `${declares.length > 0 ? 'd' : 'p'}:${passeports.join(',')}>${destination}`;
  // La réponse garde la question qu'elle concerne : changer de destination
  // n'affiche jamais, le temps d'un rendu, le visa de la précédente.
  const [lue, setLue] = useState<{ cle: string; reponse: ReponseDeVisa | null } | null>(null);
  useEffect(() => {
    if (passeports.length === 0) return;
    let actif = true;
    import('@tripora/core/visas')
      .then(({ meilleureExigence, RELEVE_DES_VISAS }) => {
        const trouvee = meilleureExigence(passeports, destination);
        const reponse =
          trouvee ?
            {
              exigence: { formalite: trouvee.formalite, jours: trouvee.jours },
              releve: RELEVE_DES_VISAS,
              passeport: declares.length > 0 ? trouvee.passeport : null,
            }
          : null;
        if (actif) setLue({ cle, reponse });
      })
      // Hors ligne avant d'avoir jamais chargé le tableau : la ligne se tait.
      .catch(() => undefined);
    return () => {
      actif = false;
    };
    // La clé résume les passeports et la destination.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  return lue?.cle === cle ? lue.reponse : null;
}

/** Une formalité qui demande une démarche avant le départ. */
export function estContraignante({ formalite }: ExigenceDeVisa): boolean {
  return formalite !== 'sans-visa' && formalite !== 'visa-a-l-arrivee';
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
