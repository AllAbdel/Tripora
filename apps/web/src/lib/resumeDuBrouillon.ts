import { findDestination, formatCents, localeActive, MONTHS_FR } from '@tripora/core';
import type { TripDraft } from '@/stores/tripDraft';

export interface LigneDuResume {
  terme: string;
  valeur: string;
}

/**
 * Le trip en quelques lignes, tel qu'on vient de le composer.
 *
 * Montré au moment de demander un compte : c'est là que tout se joue. Voir
 * ses six réponses reprises noir sur blanc rappelle ce qu'on perdrait en
 * fermant l'onglet — bien mieux qu'un argument sur les avantages d'un compte.
 */
export function resumeDuBrouillon(draft: TripDraft): LigneDuResume[] {
  const lignes: LigneDuResume[] = [];

  lignes.push({
    terme: 'Qui',
    valeur: draft.participants === 1 ? 'Vous, en solo' : `${draft.participants} personnes`,
  });

  if (draft.origin) lignes.push({ terme: 'Départ', valeur: draft.origin.name });

  const noms = draft.destinationIds
    .map((id) => findDestination(id)?.name)
    .filter((nom): nom is string => Boolean(nom));
  lignes.push({
    terme: 'Destination',
    valeur:
      draft.destinationMode === 'fixed' && noms.length > 0
        ? noms.join(', ')
        : 'Tripora vous propose des destinations',
  });

  lignes.push({ terme: 'Quand', valeur: periode(draft) });

  lignes.push({
    terme: 'Budget',
    valeur:
      draft.budgetMode === 'cheapest' || draft.budgetPerPersonCents === null
        ? 'Le moins cher possible'
        : `${formatCents(draft.budgetPerPersonCents, 'EUR', { hideCentimes: true })} par personne`,
  });

  const envies = Object.values(draft.weights).filter((poids) => (poids ?? 0) > 0).length;
  if (envies > 0) {
    lignes.push({ terme: 'Envies', valeur: `${envies} envie${envies > 1 ? 's' : ''} notée${envies > 1 ? 's' : ''}` });
  }

  return lignes;
}

function periode(draft: TripDraft): string {
  const duree = `${draft.durationDays} jour${draft.durationDays > 1 ? 's' : ''}`;
  const jour = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(localeActive(), { day: 'numeric', month: 'long' });

  if (draft.dateMode === 'exact' && draft.startDate && draft.endDate) {
    return `Du ${jour(draft.startDate)} au ${jour(draft.endDate)}`;
  }
  if (draft.dateMode === 'window' && draft.windowStart && draft.windowEnd) {
    return `${duree} entre le ${jour(draft.windowStart)} et le ${jour(draft.windowEnd)}`;
  }
  if (draft.dateMode === 'month' && draft.month) {
    return `${duree} en ${MONTHS_FR[draft.month - 1]}`;
  }
  if (draft.dateMode === 'weekend') return 'Un week-end';
  return `${duree}, dates souples`;
}
