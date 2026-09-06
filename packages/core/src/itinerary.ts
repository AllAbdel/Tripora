import { DAILY_BASELINE_CENTS } from './cost.js';
import { AXIS_LABELS_FR, PREFERENCE_AXES, type PreferenceAxis } from './preferences.js';
import type { Destination, MemberPreference, TripConstraints } from './types.js';

/**
 * Construction de l'itinéraire jour par jour.
 *
 * Règle absolue : **on n'invente aucun lieu**. Le moteur produit la structure
 * du séjour — combien de créneaux, quel jour, à quelle heure, pour quelle
 * envie, avec quelle enveloppe — et laisse le groupe y poser les vrais
 * endroits. Un itinéraire qui citerait « Trattoria da Mario » sans l'avoir
 * relevé quelque part serait un mensonge bien présenté.
 *
 * La promesse d'équité vaut ici aussi : avant de répartir les créneaux selon
 * les envies moyennes du groupe, on en réserve un à la première envie de
 * chaque participant. Personne ne doit traverser cinq jours sans rien qui lui
 * ressemble.
 */

export type SlotKind = 'transit' | 'checkin' | 'checkout' | 'activity' | 'meal' | 'evening';

export interface ItinerarySlot {
  position: number;
  kind: SlotKind;
  /** Envie servie par ce créneau, quand c'en est une. */
  axis?: PreferenceAxis;
  title: string;
  startTime: string;
  endTime?: string;
  budgetCents: number;
  /** Pourquoi ce créneau est là. Affiché tel quel, jamais reformulé par l'IA. */
  reason: string;
  /** Participant pour qui le créneau a été réservé, le cas échéant. */
  forUserId?: string;
}

export interface ItineraryDay {
  dayIndex: number;
  date?: string;
  summary: string;
  slots: ItinerarySlot[];
}

export interface Itinerary {
  days: ItineraryDay[];
  totalBudgetCents: number;
  /** Chaque participant qui a exprimé une envie la retrouve-t-il au programme ? */
  everyoneServed: boolean;
  /** Envies retenues, dans l'ordre où elles ont été placées. */
  axes: PreferenceAxis[];
}

/** Intitulés neutres : ils décrivent un type de moment, pas un lieu précis. */
const TITRES: Record<PreferenceAxis, string> = {
  culture: 'Musées et monuments',
  nature: 'Nature et grand air',
  food: 'Découverte culinaire',
  nightlife: 'Sortie du soir',
  relax: 'Temps libre',
  adventure: 'Activité sportive',
  shopping: 'Shopping',
  offbeat: 'Coin insolite',
};

/** En dessous, la destination n'a pas de quoi tenir la promesse : on n'y planifie rien. */
const PRESENCE_MINIMALE = 0.35;

export interface ItineraryInput {
  destination: Destination;
  constraints: TripConstraints;
  members: readonly MemberPreference[];
}

export function buildItinerary({
  destination,
  constraints,
  members,
}: ItineraryInput): Itinerary {
  const jours = Math.max(1, Math.round(constraints.durationDays));
  const budget = DAILY_BASELINE_CENTS[constraints.comfortLevel];
  const index = destination.costIndex;
  const budgetActivitesParJour = Math.round(budget.activities * index);
  const budgetNourritureParJour = Math.round(budget.food * index);

  const capacites = capaciteParJour(jours);
  const total = capacites.reduce((somme, n) => somme + n, 0);
  const plan = repartirEnvies({ destination, members, creneaux: total });

  const days: ItineraryDay[] = [];
  let curseur = 0;

  for (let jour = 1; jour <= jours; jour += 1) {
    const activites = plan.slice(curseur, curseur + capacites[jour - 1]!);
    curseur += capacites[jour - 1]!;
    days.push(
      construireJournee({
        jour,
        jours,
        activites,
        budgetActivitesParJour,
        budgetNourritureParJour,
        soiree: meriteUneSoiree({ destination, members, jour, jours }),
        date: dateDuJour(constraints, jour),
      }),
    );
  }

  const servis = new Set(plan.map((entree) => entree.forUserId).filter(Boolean));
  const attendus = members.filter((membre) => premiereEnvie(membre, destination) !== null);

  return {
    days,
    totalBudgetCents: days.reduce(
      (somme, day) => somme + day.slots.reduce((s, slot) => s + slot.budgetCents, 0),
      0,
    ),
    everyoneServed: attendus.every((membre) => servis.has(membre.userId)),
    axes: plan.map((entree) => entree.axis),
  };
}

/** Une journée pleine tient deux activités ; l'arrivée et le départ, une seule. */
function capaciteParJour(jours: number): number[] {
  if (jours === 1) return [2];
  return Array.from({ length: jours }, (_, position) =>
    position === 0 || position === jours - 1 ? 1 : 2,
  );
}

interface EntreePlan {
  axis: PreferenceAxis;
  reason: string;
  forUserId?: string;
}

/**
 * Répartition des envies sur les créneaux disponibles.
 *
 * D'abord l'équité — une envie par personne — puis les priorités du groupe,
 * pondérées par ce que la destination sait réellement offrir. On évite enfin
 * de programmer deux fois la même chose d'affilée.
 */
function repartirEnvies({
  destination,
  members,
  creneaux,
}: {
  destination: Destination;
  members: readonly MemberPreference[];
  creneaux: number;
}): EntreePlan[] {
  const disponibles = PREFERENCE_AXES.filter(
    (axis) => destination.tags[axis] >= PRESENCE_MINIMALE,
  );
  if (disponibles.length === 0 || creneaux === 0) return [];

  const plan: EntreePlan[] = [];
  const dejaReserve = new Set<PreferenceAxis>();

  // 1. Une envie garantie par participant.
  for (const membre of members) {
    if (plan.length >= creneaux) break;
    const axis = premiereEnvie(membre, destination);
    if (!axis || dejaReserve.has(axis)) continue;
    dejaReserve.add(axis);
    plan.push({
      axis,
      forUserId: membre.userId,
      reason: membre.displayName
        ? `Réservé pour ${membre.displayName}, dont c’est la première envie`
        : 'Réservé pour un participant dont c’est la première envie',
    });
  }

  // 2. Le reste selon les priorités du groupe, tempérées par la destination.
  const classement = disponibles
    .map((axis) => ({
      axis,
      poids: poidsDuGroupe(members, axis) * destination.tags[axis],
    }))
    .filter((entree) => entree.poids > 0)
    .sort((a, b) => b.poids - a.poids || a.axis.localeCompare(b.axis));

  let tour = 0;
  while (plan.length < creneaux && classement.length > 0) {
    const entree = classement[tour % classement.length]!;
    plan.push({
      axis: entree.axis,
      reason: `${AXIS_LABELS_FR[entree.axis]} : une priorité du groupe`,
    });
    tour += 1;
  }

  return eviterLesRepetitions(plan);
}

/** Deux fois la même chose d'affilée donne l'impression d'un programme paresseux. */
function eviterLesRepetitions(plan: EntreePlan[]): EntreePlan[] {
  const sortie = [...plan];
  for (let i = 1; i < sortie.length; i += 1) {
    if (sortie[i]!.axis !== sortie[i - 1]!.axis) continue;
    const echange = sortie.findIndex(
      (entree, j) =>
        j > i &&
        entree.axis !== sortie[i - 1]!.axis &&
        (j + 1 >= sortie.length || sortie[j + 1]!.axis !== sortie[i]!.axis),
    );
    if (echange > i) {
      [sortie[i], sortie[echange]] = [sortie[echange]!, sortie[i]!];
    }
  }
  return sortie;
}

function poidsDuGroupe(members: readonly MemberPreference[], axis: PreferenceAxis): number {
  if (members.length === 0) return 0.5;
  return members.reduce((somme, membre) => somme + membre.weights[axis], 0) / members.length;
}

/** La plus forte envie d'une personne, parmi ce que la destination offre vraiment. */
function premiereEnvie(
  membre: MemberPreference,
  destination: Destination,
): PreferenceAxis | null {
  const candidats = PREFERENCE_AXES.filter(
    (axis) => membre.weights[axis] > 0 && destination.tags[axis] >= PRESENCE_MINIMALE,
  ).sort((a, b) => membre.weights[b] - membre.weights[a] || a.localeCompare(b));
  return candidats[0] ?? null;
}

function meriteUneSoiree({
  destination,
  members,
  jour,
  jours,
}: {
  destination: Destination;
  members: readonly MemberPreference[];
  jour: number;
  jours: number;
}): boolean {
  // Jamais la veille du départ : personne n'aime prendre un avion en ruine.
  if (jours > 1 && jour === jours) return false;
  if (destination.tags.nightlife < 0.5) return false;
  if (poidsDuGroupe(members, 'nightlife') < 0.5) return false;
  // Une soirée sur deux : enchaîner toutes les nuits épuise le séjour.
  return jour % 2 === 1;
}

function construireJournee({
  jour,
  jours,
  activites,
  budgetActivitesParJour,
  budgetNourritureParJour,
  soiree,
  date,
}: {
  jour: number;
  jours: number;
  activites: EntreePlan[];
  budgetActivitesParJour: number;
  budgetNourritureParJour: number;
  soiree: boolean;
  date: string | undefined;
}): ItineraryDay {
  const slots: ItinerarySlot[] = [];
  const premier = jour === 1;
  const dernier = jour === jours && jours > 1;
  const budgetParActivite =
    activites.length > 0 ? Math.round(budgetActivitesParJour / activites.length) : 0;

  let position = 0;
  const ajouter = (slot: Omit<ItinerarySlot, 'position'>) => {
    slots.push({ ...slot, position: position += 10 });
  };

  if (premier && jours > 1) {
    ajouter({
      kind: 'transit',
      title: 'Arrivée',
      startTime: '14:00',
      budgetCents: 0,
      reason: 'Horaire à ajuster une fois le transport réservé',
    });
    ajouter({
      kind: 'checkin',
      title: 'Installation à l’hébergement',
      startTime: '15:30',
      budgetCents: 0,
      reason: 'Poser les sacs avant de sortir',
    });
  }

  const horaires = premier && jours > 1 ? ['16:30'] : dernier ? ['09:30'] : ['09:30', '14:30'];
  const fins = premier && jours > 1 ? ['18:30'] : dernier ? ['11:30'] : ['12:30', '18:00'];

  activites.forEach((activite, rang) => {
    // Le déjeuner s'intercale entre les deux activités d'une journée pleine.
    if (rang === 1) {
      ajouter({
        kind: 'meal',
        title: 'Déjeuner',
        startTime: '12:30',
        endTime: '14:00',
        budgetCents: Math.round(budgetNourritureParJour * 0.4),
        reason: 'Sur place, selon où vous serez',
      });
    }
    ajouter({
      kind: 'activity',
      axis: activite.axis,
      title: TITRES[activite.axis],
      startTime: horaires[rang] ?? '15:00',
      ...(fins[rang] ? { endTime: fins[rang] } : {}),
      budgetCents: budgetParActivite,
      reason: activite.reason,
      ...(activite.forUserId ? { forUserId: activite.forUserId } : {}),
    });
  });

  if (dernier) {
    ajouter({
      kind: 'checkout',
      title: 'Libérer l’hébergement',
      startTime: '11:30',
      budgetCents: 0,
      reason: 'Bagages en consigne si le départ est tardif',
    });
    ajouter({
      kind: 'transit',
      title: 'Départ',
      startTime: '13:00',
      budgetCents: 0,
      reason: 'Horaire à ajuster une fois le transport réservé',
    });
  } else {
    ajouter({
      kind: 'meal',
      title: 'Dîner',
      startTime: '20:00',
      budgetCents: Math.round(budgetNourritureParJour * 0.6),
      reason: 'Le moment de tester une adresse repérée par le groupe',
    });
  }

  if (soiree) {
    ajouter({
      kind: 'evening',
      axis: 'nightlife',
      title: 'Sortie du soir',
      startTime: '22:30',
      budgetCents: 0,
      reason: 'Le groupe aime sortir, mais pas tous les soirs',
    });
  }

  return {
    dayIndex: jour,
    ...(date ? { date } : {}),
    summary: resumerJournee({ premier, dernier, jours, activites }),
    slots,
  };
}

function resumerJournee({
  premier,
  dernier,
  jours,
  activites,
}: {
  premier: boolean;
  dernier: boolean;
  jours: number;
  activites: EntreePlan[];
}): string {
  if (activites.length === 0) return dernier ? 'Départ' : 'Journée libre';
  const themes = [...new Set(activites.map((a) => AXIS_LABELS_FR[a.axis].toLowerCase()))];
  const coeur = themes.join(' et ');
  if (premier && jours > 1) return `Arrivée, puis ${coeur}`;
  if (dernier) return `${coeur.charAt(0).toUpperCase()}${coeur.slice(1)}, puis départ`;
  return coeur.charAt(0).toUpperCase() + coeur.slice(1);
}

function dateDuJour(constraints: TripConstraints, jour: number): string | undefined {
  if (!constraints.startDate) return undefined;
  const depart = new Date(`${constraints.startDate}T00:00:00Z`);
  if (Number.isNaN(depart.getTime())) return undefined;
  depart.setUTCDate(depart.getUTCDate() + jour - 1);
  return depart.toISOString().slice(0, 10);
}
