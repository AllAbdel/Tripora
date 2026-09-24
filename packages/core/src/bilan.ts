import { haversineKm } from './geo.js';
import type { GeoPoint } from './types.js';
import type { SlotKind } from './itinerary.js';
import { formatCents } from './money.js';
import { TOUR_DU_MONDE_KM } from './passeport.js';

/**
 * Le bilan d'un voyage, une fois rentré.
 *
 * Ce qu'on raconte en rentrant — « huit jours, dix-huit mille kilomètres,
 * douze activités, et le cours de cuisine, le meilleur moment » — en chiffres
 * justes, tirés de ce que le groupe a vraiment noté dans Tripora : les dates,
 * le programme, les dépenses, les envies. Rien d'inventé : un chiffre qu'on ne
 * connaît pas n'apparaît pas.
 */

export interface DonneesDuBilan {
  ville: string | null;
  pays: string | null;
  debut: string | null;
  fin: string | null;
  participants: number;
  origine: GeoPoint | null;
  destination: GeoPoint | null;
  /** Les dépenses du groupe, en centimes d'euro, avec le nom de leur catégorie. */
  depenses: readonly { montantCents: number; categorie: string }[];
  /** Le programme : ce qui a été prévu, jour par jour. */
  programme: readonly { kind: SlotKind; title: string }[];
  /** L'activité que le plus de monde voulait faire, s'il y en a une. */
  coupDeCoeur: { titre: string; pour: number } | null;
}

export interface Bilan {
  jours: number | null;
  nuits: number | null;
  /** Aller-retour, à vol d'oiseau. */
  km: number | null;
  participants: number;
  activites: number;
  repas: number;
  soirees: number;
  totalCents: number;
  parPersonneCents: number | null;
  parJourCents: number | null;
  premierPoste: { categorie: string; part: number } | null;
  coupDeCoeur: { titre: string; pour: number; sur: number } | null;
  /** Les chiffres, racontés : une phrase par ligne, dans l'ordre où on les dit. */
  phrases: PhraseDuBilan[];
}

/** Ce dont parle la phrase : l'écran choisit lesquelles répéter sous les grands chiffres. */
export type SujetDuBilan = 'duree' | 'distance' | 'programme' | 'depenses' | 'poste' | 'coup-de-coeur';

export interface PhraseDuBilan {
  sujet: SujetDuBilan;
  texte: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function joursEntre(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

function pluriel(nombre: number, singulier: string, plurielDuMot = `${singulier}s`): string {
  return `${nombre.toLocaleString('fr-FR')} ${nombre > 1 ? plurielDuMot : singulier}`;
}

/** « 61 % du tour de la Terre », « le tour de la Terre », « 2,5 fois le tour de la Terre ». */
export function commeLeTourDeLaTerre(km: number): string | null {
  const part = km / TOUR_DU_MONDE_KM;
  if (part < 0.05) return null;
  if (part < 0.95) return `${Math.round(part * 100)} % du tour de la Terre`;
  if (part < 1.1) return 'le tour de la Terre';
  return `${(Math.round(part * 10) / 10).toLocaleString('fr-FR')} fois le tour de la Terre`;
}

export function bilanDuVoyage(donnees: DonneesDuBilan): Bilan {
  const datesConnues =
    donnees.debut && donnees.fin && DATE.test(donnees.debut) && DATE.test(donnees.fin) && donnees.fin >= donnees.debut;
  const nuits = datesConnues ? joursEntre(donnees.debut!, donnees.fin!) : null;
  const jours = nuits === null ? null : nuits + 1;
  const km =
    donnees.origine && donnees.destination
      ? Math.round(2 * haversineKm(donnees.origine, donnees.destination))
      : null;

  const compter = (genre: SlotKind) => donnees.programme.filter((ligne) => ligne.kind === genre && ligne.title.trim()).length;
  const activites = compter('activity');
  const repas = compter('meal');
  const soirees = compter('evening');

  const totalCents = donnees.depenses.reduce((total, depense) => total + depense.montantCents, 0);
  const participants = Math.max(1, donnees.participants);
  const parPersonneCents = totalCents > 0 ? Math.round(totalCents / participants) : null;
  const parJourCents = totalCents > 0 && jours ? Math.round(totalCents / participants / jours) : null;

  const parCategorie = new Map<string, number>();
  for (const depense of donnees.depenses) {
    parCategorie.set(depense.categorie, (parCategorie.get(depense.categorie) ?? 0) + depense.montantCents);
  }
  const [premiere] = [...parCategorie.entries()].sort((a, b) => b[1] - a[1]);
  const premierPoste =
    premiere && totalCents > 0 && parCategorie.size > 1
      ? { categorie: premiere[0], part: Math.round((premiere[1] / totalCents) * 100) }
      : null;

  const coupDeCoeur =
    donnees.coupDeCoeur && donnees.coupDeCoeur.pour > 0
      ? { ...donnees.coupDeCoeur, sur: Math.max(participants, donnees.coupDeCoeur.pour) }
      : null;

  const phrases: PhraseDuBilan[] = [];
  const dire = (sujet: SujetDuBilan, texte: string) => phrases.push({ sujet, texte });
  if (jours !== null) dire('duree', nuits! > 0 ? `${pluriel(jours, 'jour')}, ${pluriel(nuits!, 'nuit')}` : 'Une journée');
  if (km !== null && km >= 10) {
    const comparaison = commeLeTourDeLaTerre(km);
    dire('distance', `${km.toLocaleString('fr-FR')} km aller-retour${comparaison ? `, ${comparaison}` : ''}`);
  }
  const programme = [
    activites > 0 && pluriel(activites, 'activité'),
    repas > 0 && pluriel(repas, 'repas', 'repas'),
    soirees > 0 && pluriel(soirees, 'soirée'),
  ].filter(Boolean);
  if (programme.length > 0) dire('programme', programme.join(', '));
  if (parPersonneCents !== null) {
    const parJour = parJourCents !== null ? `, ${formatCents(parJourCents, 'EUR', { hideCentimes: true })} par jour` : '';
    dire(
      'depenses',
      participants > 1
        ? `${formatCents(parPersonneCents, 'EUR', { hideCentimes: true })} par personne${parJour}`
        : `${formatCents(parPersonneCents, 'EUR', { hideCentimes: true })} dépensés${parJour}`,
    );
  }
  if (premierPoste) dire('poste', `Premier poste : ${premierPoste.categorie.toLowerCase()} (${premierPoste.part} %)`);
  if (coupDeCoeur) {
    dire(
      'coup-de-coeur',
      participants > 1
        ? `Le coup de cœur du groupe : ${coupDeCoeur.titre} (${coupDeCoeur.pour} sur ${coupDeCoeur.sur})`
        : `Le coup de cœur : ${coupDeCoeur.titre}`,
    );
  }

  return {
    jours,
    nuits,
    km,
    participants,
    activites,
    repas,
    soirees,
    totalCents,
    parPersonneCents,
    parJourCents,
    premierPoste,
    coupDeCoeur,
    phrases,
  };
}
