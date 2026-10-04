import {
  AXIS_LABELS_FR,
  formatCents,
  MONTHS_FR,
  searchDestinations,
  searchOrigins,
  type ComfortLevel,
  type GroupType,
  type PreferenceAxis,
  type TripDraft as AiDraft,
} from '@tripora/core';
import type { TripDraft as StoreTripDraft } from '@/stores/tripDraft';

/**
 * Ce qu'on fait d'un brouillon issu d'une phrase : le montrer, puis le reporter.
 *
 * Séparé du composant parce que c'est là qu'est la logique qui mérite des
 * tests — la résolution des noms de villes et le refus de ce qui n'est pas
 * reconnu. L'écran, lui, n'a qu'à afficher.
 */

/** Ce qui a été compris, en français, pour que la personne puisse le démentir. */
export function resumer(draft: AiDraft): string[] {
  const lignes: string[] = [];
  if (draft.participants !== undefined) {
    lignes.push(`${draft.participants} personne${draft.participants > 1 ? 's' : ''}`);
  }
  if (draft.origin !== undefined) lignes.push(`départ de ${draft.origin}`);
  if (draft.destination !== undefined) lignes.push(`vers ${draft.destination}`);
  if (draft.durationDays !== undefined) lignes.push(`${draft.durationDays} jours`);
  if (draft.month !== undefined) lignes.push(`en ${MONTHS_FR[draft.month - 1]}`);
  if (draft.budgetPerPersonCents !== undefined) {
    lignes.push(`${formatCents(draft.budgetPerPersonCents, 'EUR', { hideCentimes: true })} max`);
  }
  if (draft.comfortLevel !== undefined) lignes.push(CONFORT_FR[draft.comfortLevel]);
  if (draft.groupType !== undefined) lignes.push(GROUPE_FR[draft.groupType]);
  for (const [axe, valeur] of Object.entries(draft.weights ?? {})) {
    if (valeur > 0) lignes.push(AXIS_LABELS_FR[axe as PreferenceAxis]);
  }
  return lignes;
}

const CONFORT_FR: Record<ComfortLevel, string> = {
  budget: 'petit budget',
  mid: 'confort normal',
  comfort: 'confortable',
};
const GROUPE_FR: Record<GroupType, string> = {
  solo: 'en solo',
  couple: 'en couple',
  friends: 'entre amis',
  family: 'en famille',
  custom: 'groupe',
};

/**
 * Report du brouillon dans le formulaire.
 *
 * Les noms de villes sont résolus contre les catalogues : le modèle écrit
 * « Lyon », Tripora a besoin de coordonnées et de codes d'aéroport. Un nom
 * qu'aucun catalogue ne connaît est simplement ignoré — l'écran suivant
 * proposera de le chercher à la main.
 */
export interface CibleBrouillon {
  patch: (values: Partial<StoreTripDraft>) => void;
  setWeight: (axis: PreferenceAxis, value: number) => void;
}

export function appliquerBrouillon(brouillon: AiDraft, cible: CibleBrouillon): void {
  const changements: Partial<StoreTripDraft> = {};

  if (brouillon.participants !== undefined) changements.participants = brouillon.participants;
  if (brouillon.durationDays !== undefined) changements.durationDays = brouillon.durationDays;
  if (brouillon.groupType !== undefined) changements.groupType = brouillon.groupType;
  if (brouillon.comfortLevel !== undefined) changements.comfortLevel = brouillon.comfortLevel;

  if (brouillon.month !== undefined) {
    changements.month = brouillon.month;
    changements.dateMode = 'month';
  }

  if (brouillon.budgetPerPersonCents !== undefined) {
    changements.budgetPerPersonCents = brouillon.budgetPerPersonCents;
    changements.budgetMode = 'max_per_person';
  }

  if (brouillon.origin !== undefined) {
    const trouvee = searchOrigins(brouillon.origin, 1)[0];
    if (trouvee) changements.origin = trouvee;
  }

  if (brouillon.destination !== undefined) {
    const trouvee = searchDestinations(brouillon.destination, 1)[0];
    if (trouvee) {
      changements.destinationMode = 'fixed';
      changements.destinationIds = [trouvee.id];
    }
  }

  cible.patch(changements);
  for (const [axe, valeur] of Object.entries(brouillon.weights ?? {})) {
    cible.setWeight(axe as PreferenceAxis, valeur);
  }
}
