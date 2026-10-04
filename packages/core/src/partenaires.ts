import { continentDe, type Continent } from './continents.js';
import type { Destination } from './types.js';

/**
 * Les partenaires Travelpayouts de Tripora, et d'où viennent leurs numéros.
 *
 * Chaque programme a été rejoint dans le tableau de bord, qui a produit un
 * lien court (`xxx.tpk.lu/…`). Derrière chaque lien court, un lien complet de
 * la forme :
 *
 *   https://tp.media/r?campaign_id=…&marker=…&p=…&trs=…&u=<page du partenaire>
 *
 * dont on a relevé `p` (le programme) et `campaign_id` le 24 septembre 2026.
 * **Inventer ces numéros ne produit pas un lien qui rapporte : ça produit un
 * lien qui ne rapporte rien, ou qui casse.** Ajouter un partenaire se fait
 * ici, à partir d'un lien du tableau de bord, jamais de mémoire.
 *
 * Deux liens courts n'ont pas pu être dépliés (Compensair répond par une
 * adresse mal formée, Intui boucle sur ses redirections) : on garde alors le
 * lien court tel quel. Il est permanent et porte déjà l'identifiant.
 *
 * La page d'arrivée est celle du tableau de bord — l'accueil du site — sauf
 * quand on sait préremplir une recherche (Aviasales, Klook).
 */

export type RubriqueDePartenaire =
  | 'activites'
  | 'transfert'
  | 'voiture'
  | 'deux-roues'
  | 'internet'
  | 'bagages'
  | 'indemnisation';

export interface Partenaire {
  id: string;
  nom: string;
  rubrique: RubriqueDePartenaire | 'vols';
  /** Ce qu'on y trouve, en quelques mots. */
  note: string;
  /** La page d'arrivée par défaut, relevée sur le lien du tableau de bord. */
  accueil: string;
  /** Les numéros Travelpayouts, quand le lien complet a pu être relevé. */
  numeros?: { programme: string; campagne: string };
  /** Le lien court du tableau de bord, quand il n'a pas pu être déplié. */
  lienCourt?: string;
  /** Les continents où le proposer. Absent : partout. */
  continents?: readonly Continent[];
}

export const PARTENAIRES: readonly Partenaire[] = [
  // Vols — la recherche préremplie est construite par `travelLinks`.
  { id: 'aviasales', nom: 'Aviasales', rubrique: 'vols', note: 'Vols', accueil: 'https://aviasales.com', numeros: { programme: '4114', campagne: '100' } },

  // Que faire sur place
  { id: 'klook', nom: 'Klook', rubrique: 'activites', note: 'Visites, billets et excursions', accueil: 'https://klook.com', numeros: { programme: '4110', campagne: '137' } },
  { id: 'tiqets', nom: 'Tiqets', rubrique: 'activites', note: 'Musées et monuments, billets coupe-file', accueil: 'https://tiqets.com', numeros: { programme: '2074', campagne: '89' } },
  { id: 'gocity', nom: 'Go City', rubrique: 'activites', note: 'Pass multi-attractions des grandes villes', accueil: 'https://gocity.com', numeros: { programme: '1942', campagne: '62' } },
  { id: 'wegotrip', nom: 'WeGoTrip', rubrique: 'activites', note: 'Visites audioguidées à son rythme', accueil: 'https://wegotrip.com', numeros: { programme: '4487', campagne: '150' } },
  { id: 'kkday', nom: 'KKday', rubrique: 'activites', note: 'Activités et excursions, surtout en Asie', accueil: 'https://kkday.com', numeros: { programme: '9074', campagne: '633' }, continents: ['asie'] },

  // Depuis l'aéroport
  { id: 'welcomepickups', nom: 'Welcome Pickups', rubrique: 'transfert', note: 'Chauffeur qui attend à l’arrivée, prix fixé d’avance', accueil: 'https://welcomepickups.com', numeros: { programme: '8919', campagne: '627' } },
  { id: 'kiwitaxi', nom: 'Kiwitaxi', rubrique: 'transfert', note: 'Transferts réservés, du taxi au minibus', accueil: 'https://kiwitaxi.com', numeros: { programme: '647', campagne: '1' } },
  { id: 'gettransfer', nom: 'GetTransfer', rubrique: 'transfert', note: 'Des chauffeurs font une offre pour votre trajet', accueil: 'https://gettransfer.com', numeros: { programme: '4439', campagne: '147' } },
  { id: 'intui', nom: 'Intui', rubrique: 'transfert', note: 'Transferts privés à prix fixe', accueil: 'https://intui.travel', lienCourt: 'https://intui.tpk.lu/PKSyCQJp' },

  // Louer une voiture
  { id: 'economybookings', nom: 'EconomyBookings', rubrique: 'voiture', note: 'Comparateur de loueurs', accueil: 'https://www.economybookings.com', numeros: { programme: '2018', campagne: '10' } },
  { id: 'autoeurope', nom: 'Auto Europe', rubrique: 'voiture', note: 'Comparateur de loueurs', accueil: 'https://autoeurope.eu', numeros: { programme: '4354', campagne: '143' } },
  { id: 'localrent', nom: 'Localrent', rubrique: 'voiture', note: 'Loueurs locaux, souvent sans carte de crédit', accueil: 'https://localrent.com/en', numeros: { programme: '2043', campagne: '87' } },
  { id: 'getrentacar', nom: 'GetRentacar', rubrique: 'voiture', note: 'Voitures de loueurs et de particuliers', accueil: 'https://getrentacar.com', numeros: { programme: '5996', campagne: '222' } },

  // Deux-roues
  { id: 'bikesbooking', nom: 'BikesBooking', rubrique: 'deux-roues', note: 'Scooters, motos et vélos à louer', accueil: 'https://bikesbooking.com', numeros: { programme: '1767', campagne: '57' } },

  // Internet sur place
  { id: 'airalo', nom: 'Airalo', rubrique: 'internet', note: 'eSIM de données, par pays ou par région', accueil: 'https://airalo.com', numeros: { programme: '8310', campagne: '541' } },
  { id: 'yesim', nom: 'Yesim', rubrique: 'internet', note: 'eSIM de données', accueil: 'https://yesim.tech', numeros: { programme: '5998', campagne: '224' } },
  { id: 'saily', nom: 'Saily', rubrique: 'internet', note: 'eSIM de données', accueil: 'https://saily.com', numeros: { programme: '8979', campagne: '629' } },
  { id: 'drimsim', nom: 'Drimsim', rubrique: 'internet', note: 'Carte SIM qui marche dans presque tous les pays', accueil: 'https://w1.drimsim.com', numeros: { programme: '2762', campagne: '102' } },

  // Bagages
  { id: 'radicalstorage', nom: 'Radical Storage', rubrique: 'bagages', note: 'Consigne à bagages dans des commerces du quartier', accueil: 'https://radicalstorage.com', numeros: { programme: '5867', campagne: '209' } },

  // Après un vol raté
  { id: 'airhelp', nom: 'AirHelp', rubrique: 'indemnisation', note: 'Réclame l’indemnité à la compagnie à votre place', accueil: 'https://airhelp.com', numeros: { programme: '9139', campagne: '120' } },
  { id: 'compensair', nom: 'Compensair', rubrique: 'indemnisation', note: 'Réclame l’indemnité à la compagnie à votre place', accueil: 'https://compensair.com', lienCourt: 'https://compensair.tpk.lu/3p7evUtk' },
];

const PAR_ID: ReadonlyMap<string, Partenaire> = new Map(PARTENAIRES.map((p) => [p.id, p]));

export function trouverPartenaire(id: string): Partenaire | undefined {
  return PAR_ID.get(id);
}

/**
 * Les partenaires d'une rubrique qui ont du sens pour cette destination.
 *
 * Dans l'ordre alphabétique, et rien d'autre : l'ordre ne dépend jamais de ce
 * qu'un partenaire rapporte. Un test le vérifie.
 */
export function partenairesDe(
  rubrique: RubriqueDePartenaire,
  destination?: Pick<Destination, 'countryCode'>,
): Partenaire[] {
  const continent = destination ? continentDe(destination.countryCode) : undefined;
  return PARTENAIRES.filter(
    (partenaire) =>
      partenaire.rubrique === rubrique &&
      (!partenaire.continents || (continent !== undefined && partenaire.continents.includes(continent))),
  ).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

export const TITRES_DES_RUBRIQUES: Readonly<Record<RubriqueDePartenaire, string>> = {
  activites: 'Visites et billets',
  transfert: 'Depuis l’aéroport',
  voiture: 'Louer une voiture',
  'deux-roues': 'Louer un scooter ou un vélo',
  internet: 'Internet sur place (eSIM)',
  bagages: 'Laisser ses bagages',
  indemnisation: 'Vol retardé ou annulé',
};
