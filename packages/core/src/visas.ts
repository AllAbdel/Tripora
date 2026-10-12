import { PAYS_DES_VISAS, RELEVE_DES_VISAS, VISAS_DU_MONDE } from './visas-du-monde.js';

/**
 * Faut-il un visa ? Selon le passeport et le pays visité.
 *
 * Les données viennent de « Passport Index Data » (licence MIT), relevées par
 * `scripts/visas.py` et embarquées : la réponse est là sans réseau. Elles
 * pèsent une quinzaine de kilo-octets compressés, si bien que l'application
 * ne charge ce module qu'à la demande (`@tripora/core/visas`), pas avec le
 * reste du cœur.
 *
 * C'est une indication, jamais une garantie : les règles changent, et
 * l'écran renvoie toujours aux sources officielles avec la date du relevé.
 */

export { RELEVE_DES_VISAS };

export type Formalite =
  | 'sans-visa'
  | 'visa-a-l-arrivee'
  | 'autorisation-electronique'
  | 'visa-electronique'
  | 'visa'
  | 'entree-refusee';

export interface ExigenceDeVisa {
  formalite: Formalite;
  /** Durée de séjour autorisée, en jours, quand la source la donne. */
  jours: number | null;
}

const FORMALITES: Record<string, Formalite> = {
  L: 'sans-visa',
  A: 'visa-a-l-arrivee',
  E: 'autorisation-electronique',
  V: 'visa-electronique',
  R: 'visa',
  N: 'entree-refusee',
};

const ORDRE = PAYS_DES_VISAS.split(' ');
const RANG = new Map(ORDRE.map((code, rang) => [code, rang]));

/** Une ligne lue une fois, gardée : on la relit à chaque rendu. */
const lues = new Map<string, readonly (ExigenceDeVisa | null)[]>();

function lireLigne(passeport: string): readonly (ExigenceDeVisa | null)[] | undefined {
  const deja = lues.get(passeport);
  if (deja) return deja;
  const brute = VISAS_DU_MONDE[passeport];
  if (brute === undefined) return undefined;
  const ligne = [...brute.matchAll(/([A-Z-])(\d*)/gu)].map(([, lettre, jours]) => {
    const formalite = FORMALITES[lettre!];
    return formalite ? { formalite, jours: jours ? Number(jours) : null } : null;
  });
  lues.set(passeport, ligne);
  return ligne;
}

/**
 * Ce que demande `destination` à un voyageur muni d'un passeport de
 * `passeport` (codes ISO à deux lettres). `undefined` quand on ne sait pas :
 * même pays, territoire absent de la source, ou passeport inconnu — l'écran
 * se tait plutôt que de deviner.
 */
export function exigenceDeVisa(
  passeport: string | null | undefined,
  destination: string | null | undefined,
): ExigenceDeVisa | undefined {
  const depuis = passeport?.toUpperCase();
  const vers = destination?.toUpperCase();
  if (!depuis || !vers || depuis === vers) return undefined;
  const rang = RANG.get(vers);
  if (rang === undefined) return undefined;
  return lireLigne(depuis)?.[rang] ?? undefined;
}
