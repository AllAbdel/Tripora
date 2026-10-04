import { beforeEach, describe, expect, it } from 'vitest';
import {
  isStepComplete,
  suggestTitle,
  toConstraints,
  toMemberPreference,
  useTripDraft,
  type TripDraft,
} from './tripDraft';

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522 };

function draft(overrides: Partial<TripDraft> = {}): TripDraft {
  useTripDraft.getState().reset();
  return { ...useTripDraft.getState(), ...overrides };
}

beforeEach(() => useTripDraft.getState().reset());

describe('validation des étapes', () => {
  it('exige une ville de départ, parce que le calcul a besoin de coordonnées', () => {
    expect(isStepComplete('depart', draft())).toBe(false);
    expect(isStepComplete('depart', draft({ origin: PARIS }))).toBe(true);
  });

  it('accepte « surprends-nous » comme une réponse à part entière', () => {
    expect(isStepComplete('destination', draft({ destinationMode: 'suggest' }))).toBe(true);
    expect(
      isStepComplete('destination', draft({ destinationMode: 'fixed', destinationIds: [] })),
    ).toBe(false);
    expect(
      isStepComplete('destination', draft({ destinationMode: 'fixed', destinationIds: ['rome'] })),
    ).toBe(true);
  });

  it('adapte ce qu’elle exige au mode de dates choisi', () => {
    expect(isStepComplete('dates', draft({ dateMode: 'month', month: null }))).toBe(false);
    expect(isStepComplete('dates', draft({ dateMode: 'month', month: 6 }))).toBe(true);
    expect(isStepComplete('dates', draft({ dateMode: 'weekend' }))).toBe(true);
    expect(
      isStepComplete('dates', draft({ dateMode: 'exact', startDate: '2026-10-01' })),
    ).toBe(false);
    expect(
      isStepComplete(
        'dates',
        draft({ dateMode: 'exact', startDate: '2026-10-01', endDate: '2026-10-05' }),
      ),
    ).toBe(true);
  });

  it('n’exige pas de montant quand on veut « le moins cher possible »', () => {
    expect(isStepComplete('budget', draft({ budgetMode: 'cheapest' }))).toBe(true);
    expect(
      isStepComplete('budget', draft({ budgetMode: 'max_per_person', budgetPerPersonCents: null })),
    ).toBe(false);
  });

  it('distingue « pas encore répondu » de « non merci »', () => {
    // Aucun axe touché : on ne peut rien optimiser.
    expect(isStepComplete('envies', draft())).toBe(false);
    // Répondre « non merci » partout ne suffit pas non plus.
    expect(isStepComplete('envies', draft({ weights: { culture: 0, food: 0 } }))).toBe(false);
    expect(isStepComplete('envies', draft({ weights: { food: 1 } }))).toBe(true);
  });
});

describe('conversion vers le moteur', () => {
  it('refuse de produire des contraintes sans point de départ', () => {
    expect(toConstraints(draft())).toBeNull();
  });

  it('n’invente pas de dates absentes', () => {
    const constraints = toConstraints(draft({ origin: PARIS, dateMode: 'month', month: 10 }));
    expect(constraints?.month).toBe(10);
    expect(constraints?.startDate).toBeUndefined();
    expect(constraints?.windowStart).toBeUndefined();
  });

  it('complète les huit axes à zéro pour le moteur, sans perdre les réponses', () => {
    const preference = toMemberPreference(draft({ weights: { food: 1, nightlife: 2 / 3 } }), 'u1');
    expect(preference.weights.food).toBe(1);
    expect(preference.weights.nightlife).toBeCloseTo(2 / 3, 5);
    expect(preference.weights.culture).toBe(0);
    expect(Object.keys(preference.weights)).toHaveLength(8);
  });
});

describe('titre proposé', () => {
  it('utilise la destination quand elle est connue', () => {
    expect(suggestTitle(draft({ participants: 5 }), 'Budapest')).toBe('Budapest à 5');
  });

  it('se rabat sur la durée et le mois', () => {
    expect(suggestTitle(draft({ durationDays: 4, month: 10 }))).toBe('4 jours en octobre');
  });

  it('respecte un titre saisi à la main', () => {
    expect(suggestTitle(draft({ title: '  Le grand départ ' }), 'Rome')).toBe('Le grand départ');
  });
});
