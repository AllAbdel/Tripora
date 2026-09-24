/**
 * Qui fait quoi : les tâches du groupe avant le départ.
 *
 * « Qui réserve la voiture ? », « quelqu'un a pris l'assurance ? » : chacun
 * croit la chose faite par un autre. Une ligne, un responsable, une échéance.
 */

export interface Tache {
  id: string;
  tripId: string;
  titre: string;
  /** L'identifiant du membre qui s'en charge, ou `null` : personne encore. */
  responsable: string | null;
  /** `AAAA-MM-JJ`, ou `null`. */
  echeance: string | null;
  faite: boolean;
  faitePar?: string | null;
  faiteLe?: string | null;
  creePar?: string | null;
  creeLe: string;
}

export type EtatDEcheance = 'en-retard' | 'aujourdhui' | 'bientot' | 'plus-tard';

const JOUR = 86_400_000;

/** Où en est l'échéance d'une tâche restant à faire. `null` sans échéance. */
export function etatDeLEcheance(echeance: string | null, aujourdhui: string): EtatDEcheance | null {
  if (!echeance) return null;
  if (echeance < aujourdhui) return 'en-retard';
  if (echeance === aujourdhui) return 'aujourdhui';
  const ecart = Math.round((Date.parse(`${echeance}T00:00:00Z`) - Date.parse(`${aujourdhui}T00:00:00Z`)) / JOUR);
  return ecart <= 3 ? 'bientot' : 'plus-tard';
}

/**
 * L'ordre de la liste : ce qui reste à faire d'abord, le plus pressé en tête,
 * les tâches sans échéance ensuite ; puis ce qui est fait, le plus récent
 * d'abord.
 */
export function trierLesTaches(taches: readonly Tache[]): Tache[] {
  const aFaire = taches
    .filter((tache) => !tache.faite)
    .sort(
      (a, b) =>
        (a.echeance ?? '9999-12-31').localeCompare(b.echeance ?? '9999-12-31') || a.creeLe.localeCompare(b.creeLe),
    );
  const faites = taches
    .filter((tache) => tache.faite)
    .sort((a, b) => (b.faiteLe ?? '').localeCompare(a.faiteLe ?? ''));
  return [...aFaire, ...faites];
}

export interface ResumeDesTaches {
  aFaire: number;
  pourMoi: number;
  enRetard: number;
}

export function resumerLesTaches(
  taches: readonly Tache[],
  moi: string | null | undefined,
  aujourdhui: string,
): ResumeDesTaches {
  const restantes = taches.filter((tache) => !tache.faite);
  return {
    aFaire: restantes.length,
    pourMoi: moi ? restantes.filter((tache) => tache.responsable === moi).length : 0,
    enRetard: restantes.filter((tache) => etatDeLEcheance(tache.echeance, aujourdhui) === 'en-retard').length,
  };
}

/**
 * Ce qu'un groupe oublie le plus souvent, proposé en un geste.
 *
 * Seulement ce qui n'est pas déjà dans la liste : proposer « Louer une
 * voiture » à côté de la ligne « Louer une voiture » ne sert à rien.
 */
export const SUGGESTIONS_DE_TACHES: readonly string[] = [
  'Réserver le logement',
  'Réserver les billets aller-retour',
  'Prendre une assurance voyage',
  'Vérifier la validité des passeports',
  'Louer une voiture',
  'Acheter une eSIM ou une carte SIM',
  'Retirer ou changer un peu de devises',
  'Réserver les visites qui affichent complet',
  'Télécharger les billets et les cartes hors ligne',
];

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function suggestionsRestantes(taches: readonly Pick<Tache, 'titre'>[]): string[] {
  const deja = new Set(taches.map((tache) => normaliser(tache.titre)));
  return SUGGESTIONS_DE_TACHES.filter((suggestion) => !deja.has(normaliser(suggestion)));
}
