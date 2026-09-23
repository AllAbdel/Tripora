import { haversineKm } from './geo.js';
import { SLOT_TITLES } from './itinerary.js';
import { rankPois, type MomentDeLaJournee, type Poi } from './places.js';
import type { PreferenceAxis } from './preferences.js';
import { direLaDuree } from './duree.js';

/**
 * Poser de vrais lieux sur la structure du séjour.
 *
 * `buildItinerary` produit un squelette honnête : « Musées et monuments,
 * mardi 10 h, 18 € ». Il ne nomme rien parce qu'il ne sait rien — inventer
 * « Trattoria da Mario » serait un mensonge bien présenté. Une fois les lieux
 * réels d'OpenStreetMap chargés, ce module fait le rapprochement : chaque
 * créneau reçoit un endroit qui existe, documenté par Wikipédia quand c'est
 * possible.
 *
 * Deux règles, et elles se voient à l'usage :
 *
 *  1. **l'envie d'abord.** Un créneau « nature » ne reçoit jamais un musée. Si
 *     la destination n'a rien de tel dans ce qu'on a relevé, le créneau reste
 *     vide et garde son titre neutre. Un trou est plus honnête qu'un
 *     remplissage à côté de la plaque ;
 *  2. **la géographie ensuite.** Le premier lieu de la journée sert d'ancre ;
 *     les suivants sont choisis parmi les candidats valables, au plus près.
 *     C'est ce qui évite la journée qui traverse la ville quatre fois.
 *
 * Rien ici ne vient d'un modèle de langage. Les lieux sont relevés, le choix
 * est calculé, et chaque proposition sait dire pourquoi elle est là.
 *
 * Trois règles de plus depuis que le carnet d'activités existe, parce qu'il
 * apporte ce qu'OpenStreetMap ignorait — le moment et la durée :
 *
 *  3. **le moment de la journée.** Le kecak d'Uluwatu se joue au coucher du
 *     soleil ; le poser dans le créneau de neuf heures parce qu'il est
 *     « culture » serait faux. Un lieu dont on connaît le moment ne va que
 *     dans un créneau de ce moment-là — et si aucun ne convient, le créneau
 *     reste vide, comme pour l'envie ;
 *  4. **la durée réelle.** Une journée tient dix heures d'activités, trajets
 *     compris. Après les huit heures du mont Batur, on ne pose pas trois
 *     musées ;
 *  5. **la journée entière.** Une excursion « à la journée » — Nusa Penida,
 *     Ayutthaya — prend sa journée pour elle seule : on part tôt, on rentre
 *     tard, et il n'y a rien d'autre à caser.
 *
 * Et une dernière, depuis que chacun peut dire ce qui lui fait envie :
 *
 *  6. **ce que le groupe a choisi passe devant, ce qu'il refuse ne passe
 *     pas.** Un lieu que le groupe réclame est posé avant tout autre de la
 *     même envie, même s'il est moins proche ; un lieu où les « sans moi »
 *     l'emportent n'est jamais proposé. Le moteur ne décide pas à la place
 *     des gens quand les gens ont déjà décidé.
 */

/** Ce que le groupe a dit d'un lieu : combien en ont envie, combien s'en passeraient. */
export interface AvisDuGroupe {
  pour: number;
  contre: number;
}

/** Le solde d'un lieu : positif s'il est réclamé, négatif s'il est refusé. */
export function soldeDuLieu(avis: AvisDuGroupe | undefined): number {
  return avis ? avis.pour - avis.contre : 0;
}

export interface SlotToFill {
  dayIndex: number;
  /** Position du créneau dans sa journée, telle que l'itinéraire la connaît. */
  position: number;
  axis: PreferenceAxis;
  /** « 09:30 ». Sans heure, le moment ne départage rien. */
  startTime?: string | null;
}

export interface FilledSlot extends SlotToFill {
  poi: Poi;
  /** Phrase affichable, qui dit pourquoi ce lieu-là. */
  reason: string;
  /** Le prix du lieu, quand on le connaît : le budget du créneau le reprend. */
  costCents?: number;
  /** L'heure à laquelle y aller, quand elle diffère de celle du créneau. */
  heureConseillee?: string;
}

/** Au-delà, deux lieux ne sont plus « dans le même coin » à pied. */
const PROCHE_KM = 2.5;

/**
 * Ce qu'une journée tient d'activités, trajets compris.
 *
 * Dix heures : de neuf heures à dix-neuf heures, avec les repas pris dedans.
 * Au-delà on ne visite plus, on court.
 */
export const HEURES_PAR_JOUR = 10;

/** Le moment d'un créneau, d'après son heure de début. */
export function momentDeLHeure(heure: string | null | undefined): MomentDeLaJournee | undefined {
  if (!heure) return undefined;
  const correspondance = /^(\d{1,2}):(\d{2})/.exec(heure);
  if (!correspondance) return undefined;
  const h = Number(correspondance[1]);
  if (h < 12) return 'matin';
  if (h < 18) return 'apres-midi';
  return 'soir';
}

/**
 * Ce lieu peut-il occuper ce créneau, et à quelle heure ?
 *
 * Renvoie `null` si non ; sinon, l'heure à laquelle il faut y aller quand elle
 * diffère de celle du créneau.
 *
 * Sans information d'un côté ou de l'autre, oui, à l'heure prévue : un musée
 * relevé sur OSM n'a pas d'horaire, un créneau sans heure n'a pas de moment.
 *
 * Deux déplacements, parce que le squelette du séjour ne connaît que deux
 * créneaux par jour — 9 h 30 et 14 h 30 — et aucun au coucher du soleil :
 *
 *  - **une activité du soir prend le créneau de l'après-midi, décalé à
 *    17 h 30.** Sans ça, Tanah Lot au coucher du soleil, le kecak d'Uluwatu
 *    et le poisson grillé de Jimbaran n'auraient jamais trouvé de place ;
 *  - **une excursion à la journée prend le créneau du matin, avancé à 8 h.**
 *    On ne part pas pour Nusa Penida à neuf heures et demie.
 */
export function accorderAuCreneau(
  lieu: MomentDeLaJournee | undefined,
  creneau: MomentDeLaJournee | undefined,
): { heure?: string } | null {
  if (!lieu || !creneau) return {};
  if (lieu === 'journee') return creneau === 'matin' ? { heure: '08:00' } : null;
  if (lieu === creneau) return {};
  if (lieu === 'soir' && creneau === 'apres-midi') return { heure: '17:30' };
  return null;
}

/** La même question, réduite à oui ou non. */
export function momentCompatible(
  lieu: MomentDeLaJournee | undefined,
  creneau: MomentDeLaJournee | undefined,
): boolean {
  return accorderAuCreneau(lieu, creneau) !== null;
}

/**
 * Le créneau attend-il encore un lieu ?
 *
 * Un titre neutre veut dire « personne n'a rien mis ici ». Dès que quelqu'un a
 * écrit un nom, on n'y touche plus : remplir un itinéraire ne doit jamais
 * effacer le choix d'un participant.
 */
export function awaitsPlace(title: string, axis: PreferenceAxis): boolean {
  return title.trim() === SLOT_TITLES[axis];
}

export function fillItinerary({
  slots,
  places,
  weights = {},
  avis = {},
}: {
  slots: readonly SlotToFill[];
  places: readonly Poi[];
  /** Envies du groupe, pour départager deux lieux également proches. */
  weights?: Partial<Record<PreferenceAxis, number>>;
  /** Ce que le groupe a dit de chaque lieu, par identifiant de lieu. */
  avis?: Readonly<Record<string, AvisDuGroupe>>;
}): FilledSlot[] {
  const solde = (lieu: Poi): number => soldeDuLieu(avis[lieu.id]);
  // Le tri est stable : à solde égal, l'ordre des envies du groupe demeure.
  const classes = rankPois(
    places.filter((lieu) => solde(lieu) >= 0),
    weights,
  ).sort((a, b) => solde(b) - solde(a));
  const utilises = new Set<string>();
  const remplis: FilledSlot[] = [];

  // Les journées dans l'ordre, chacune avec ses créneaux dans l'ordre : c'est
  // la première activité qui décide du quartier, les suivantes la rejoignent.
  const parJour = new Map<number, SlotToFill[]>();
  for (const creneau of slots) {
    const liste = parJour.get(creneau.dayIndex);
    if (liste) liste.push(creneau);
    else parJour.set(creneau.dayIndex, [creneau]);
  }

  for (const jour of [...parJour.keys()].sort((a, b) => a - b)) {
    const creneaux = [...parJour.get(jour)!].sort((a, b) => a.position - b.position);
    let ancre: Poi | undefined;
    let heures = 0;
    let journeePrise = false;

    for (const creneau of creneaux) {
      // Une excursion à la journée est partie : il n'y a plus rien à caser.
      if (journeePrise) break;

      const moment = momentDeLHeure(creneau.startTime);
      const candidats = classes.filter(
        (lieu) =>
          lieu.axis === creneau.axis &&
          !utilises.has(lieu.id) &&
          momentCompatible(lieu.moment, moment) &&
          // Une activité longue ne s'ajoute pas à une journée déjà remplie,
          // sauf si c'est la première : une excursion de onze heures reste
          // posable, elle occupera simplement la journée.
          (heures === 0 || heures + (lieu.dureeHeures ?? 0) <= HEURES_PAR_JOUR) &&
          // Et une excursion à la journée ne vient pas après autre chose.
          (heures === 0 || lieu.moment !== 'journee'),
      );
      if (candidats.length === 0) continue;

      // Ce que le groupe réclame passe avant la proximité : entre deux lieux
      // voulus, le plus proche ; entre un lieu voulu et un lieu voisin, le
      // lieu voulu. Les candidats sont déjà triés par solde décroissant.
      const meilleurSolde = solde(candidats[0]!);
      const retenus =
        meilleurSolde > 0 ? candidats.filter((lieu) => solde(lieu) === meilleurSolde) : candidats;
      const choisi = ancre ? leplusProche(retenus, ancre) : retenus[0]!;
      utilises.add(choisi.id);
      ancre ??= choisi;
      heures += choisi.dureeHeures ?? 0;
      if (choisi.moment === 'journee' || heures >= HEURES_PAR_JOUR) journeePrise = true;

      const accord = accorderAuCreneau(choisi.moment, moment);
      remplis.push({
        ...creneau,
        poi: choisi,
        reason: expliquer(choisi, ancre === choisi ? undefined : ancre, avis[choisi.id]),
        ...(choisi.prixCents !== undefined ? { costCents: choisi.prixCents } : {}),
        ...(accord?.heure ? { heureConseillee: accord.heure } : {}),
      });
    }
  }

  return remplis;
}

/**
 * Le plus proche de l'ancre, mais pas à n'importe quel prix.
 *
 * Au-delà du rayon de marche, la proximité ne veut plus rien dire : autant
 * reprendre le mieux classé, quitte à prendre un bus. Un lieu médiocre à
 * 300 mètres ne vaut pas mieux qu'un lieu remarquable à trois kilomètres.
 */
function leplusProche(candidats: readonly Poi[], ancre: Poi): Poi {
  let meilleur = candidats[0]!;
  let distance = haversineKm(ancre, meilleur);
  for (const candidat of candidats.slice(1)) {
    const ecart = haversineKm(ancre, candidat);
    if (ecart < distance) {
      meilleur = candidat;
      distance = ecart;
    }
  }
  return distance <= PROCHE_KM ? meilleur : candidats[0]!;
}

/**
 * D'où vient ce lieu, en une proposition.
 *
 * Trois sources, et on ne les confond pas. Le carnet d'activités écrit un
 * résumé pour chacune de ses entrées : dire « documenté par Wikipédia » à son
 * sujet serait faux, alors que c'était ce que la présence d'un résumé
 * voulait dire avant qu'il existe.
 */
function provenance(lieu: Poi): string {
  if (lieu.id.startsWith('activite:')) {
    const duree = lieu.dureeHeures !== undefined ? `, compter ${direLaDuree(lieu.dureeHeures)}` : '';
    return `${lieu.label} du carnet d’activités${duree}`;
  }
  return lieu.extract
    ? `${lieu.label} documenté par Wikipédia`
    : `${lieu.label} relevé sur OpenStreetMap`;
}

function expliquer(lieu: Poi, ancre: Poi | undefined, avis?: AvisDuGroupe): string {
  return `${situer(lieu, ancre)}${reclame(avis)}`;
}

function situer(lieu: Poi, ancre: Poi | undefined): string {
  const quoi = provenance(lieu);
  if (lieu.moment === 'journee') return `${quoi}. La journée lui est consacrée.`;
  if (!ancre) return `${quoi}.`;
  const km = haversineKm(ancre, lieu);
  if (km <= PROCHE_KM) {
    return km < 0.6
      ? `${quoi}, à deux pas de ${ancre.name}.`
      : `${quoi}, à ${km.toFixed(1)} km de ${ancre.name}.`;
  }
  return `${quoi}. Pas dans le même quartier que ${ancre.name} — comptez un trajet.`;
}

/** « Deux personnes du groupe en ont envie. » — seulement quand c'est vrai. */
function reclame(avis: AvisDuGroupe | undefined): string {
  if (!avis || avis.pour <= 0 || soldeDuLieu(avis) <= 0) return '';
  return avis.pour === 1
    ? ' Quelqu’un du groupe en a envie.'
    : ` ${avis.pour} personnes du groupe en ont envie.`;
}
