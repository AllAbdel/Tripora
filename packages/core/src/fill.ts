import { haversineKm } from './geo.js';
import { SLOT_TITLES } from './itinerary.js';
import { rankPois, type Poi } from './places.js';
import type { PreferenceAxis } from './preferences.js';

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
 */

export interface SlotToFill {
  dayIndex: number;
  /** Position du créneau dans sa journée, telle que l'itinéraire la connaît. */
  position: number;
  axis: PreferenceAxis;
}

export interface FilledSlot extends SlotToFill {
  poi: Poi;
  /** Phrase affichable, qui dit pourquoi ce lieu-là. */
  reason: string;
}

/** Au-delà, deux lieux ne sont plus « dans le même coin » à pied. */
const PROCHE_KM = 2.5;

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
}: {
  slots: readonly SlotToFill[];
  places: readonly Poi[];
  /** Envies du groupe, pour départager deux lieux également proches. */
  weights?: Partial<Record<PreferenceAxis, number>>;
}): FilledSlot[] {
  const classes = rankPois(places, weights);
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

    for (const creneau of creneaux) {
      const candidats = classes.filter(
        (lieu) => lieu.axis === creneau.axis && !utilises.has(lieu.id),
      );
      if (candidats.length === 0) continue;

      const choisi = ancre ? leplusProche(candidats, ancre) : candidats[0]!;
      utilises.add(choisi.id);
      ancre ??= choisi;

      remplis.push({
        ...creneau,
        poi: choisi,
        reason: expliquer(choisi, ancre === choisi ? undefined : ancre),
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

function expliquer(lieu: Poi, ancre: Poi | undefined): string {
  const quoi = lieu.extract
    ? `${lieu.label} documenté par Wikipédia`
    : `${lieu.label} relevé sur OpenStreetMap`;
  if (!ancre) return `${quoi}.`;
  const km = haversineKm(ancre, lieu);
  if (km <= PROCHE_KM) {
    return km < 0.6
      ? `${quoi}, à deux pas de ${ancre.name}.`
      : `${quoi}, à ${km.toFixed(1)} km de ${ancre.name}.`;
  }
  return `${quoi}. Pas dans le même quartier que ${ancre.name} — comptez un trajet.`;
}
