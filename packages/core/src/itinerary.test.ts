import { describe, expect, it } from 'vitest';
import { buildItinerary } from './itinerary.js';
import { findDestination } from './catalog/destinations.js';
import { normalizeWeights } from './preferences.js';
import type { MemberPreference, TripConstraints } from './types.js';

const ROME = findDestination('rome')!;
const BUDAPEST = findDestination('budapest')!;

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    durationDays: 4,
    dateMode: 'month',
    month: 6,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 60_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

function membre(
  userId: string,
  weights: Record<string, number>,
  displayName?: string,
): MemberPreference {
  return {
    userId,
    ...(displayName ? { displayName } : {}),
    weights: normalizeWeights(weights),
    budgetMaxCents: null,
  };
}

describe('structure du séjour', () => {
  it('produit une journée par jour de voyage', () => {
    for (const jours of [1, 2, 3, 7]) {
      const plan = buildItinerary({
        destination: ROME,
        constraints: constraints({ durationDays: jours }),
        members: [membre('a', { culture: 1 })],
      });
      expect(plan.days, `${jours} jours`).toHaveLength(jours);
      expect(plan.days.map((d) => d.dayIndex)).toEqual(
        Array.from({ length: jours }, (_, i) => i + 1),
      );
    }
  });

  it('encadre le séjour par l’arrivée, l’installation, le départ', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints({ durationDays: 3 }),
      members: [membre('a', { culture: 1 })],
    });
    const premier = plan.days[0]!.slots.map((s) => s.kind);
    const dernier = plan.days[2]!.slots.map((s) => s.kind);
    expect(premier[0]).toBe('transit');
    expect(premier).toContain('checkin');
    expect(dernier).toContain('checkout');
    expect(dernier.at(-1)).toBe('transit');
  });

  it('n’impose ni arrivée ni départ à un aller-retour dans la journée', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints({ durationDays: 1 }),
      members: [membre('a', { culture: 1 })],
    });
    const kinds = plan.days[0]!.slots.map((s) => s.kind);
    expect(kinds).not.toContain('checkin');
    expect(kinds).not.toContain('checkout');
    expect(kinds.filter((k) => k === 'activity').length).toBe(2);
  });

  it('intercale le déjeuner entre les deux activités d’une journée pleine', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints({ durationDays: 4 }),
      members: [membre('a', { culture: 1, food: 1 })],
    });
    const journee = plan.days[1]!;
    const kinds = journee.slots.map((s) => s.kind);
    expect(kinds).toEqual(['activity', 'meal', 'activity', 'meal']);
    expect(journee.slots[1]!.title).toBe('Déjeuner');
    expect(journee.slots[3]!.title).toBe('Dîner');
  });

  it('date les journées quand le départ est connu', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints({ dateMode: 'exact', startDate: '2026-10-29', durationDays: 4 }),
      members: [membre('a', { culture: 1 })],
    });
    expect(plan.days.map((d) => d.date)).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01', // le passage de mois ne doit pas dérailler
    ]);
  });

  it('ne date rien quand les dates ne sont pas fixées', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints(),
      members: [membre('a', { culture: 1 })],
    });
    expect(plan.days.every((d) => d.date === undefined)).toBe(true);
  });
});

describe('équité : chacun retrouve une de ses envies', () => {
  const groupe = [
    membre('a', { culture: 1, food: 0.66 }, 'Abdel'),
    membre('b', { nightlife: 1 }, 'Thomas'),
    membre('c', { food: 1, nature: 0.33 }, 'Mehdi'),
  ];

  it('réserve un créneau à la première envie de chaque participant', () => {
    const plan = buildItinerary({
      destination: BUDAPEST,
      constraints: constraints({ durationDays: 4 }),
      members: groupe,
    });
    expect(plan.everyoneServed).toBe(true);
    expect(plan.axes).toContain('culture');
    expect(plan.axes).toContain('nightlife');
    expect(plan.axes).toContain('food');
  });

  it('nomme la personne pour qui le créneau est réservé', () => {
    const plan = buildItinerary({
      destination: BUDAPEST,
      constraints: constraints({ durationDays: 4 }),
      members: groupe,
    });
    const reserves = plan.days
      .flatMap((d) => d.slots)
      .filter((s) => s.forUserId !== undefined);
    expect(reserves.length).toBeGreaterThanOrEqual(3);
    expect(reserves.some((s) => s.reason.includes('Thomas'))).toBe(true);
    // Apostrophes typographiques, comme dans le reste de l’interface.
    expect(reserves.every((s) => !s.reason.includes("'"))).toBe(true);
  });

  it('avoue ne pas avoir pu servir tout le monde sur un séjour trop court', () => {
    const foule = Array.from({ length: 8 }, (_, i) =>
      membre(`u${i}`, { [PREFERENCES[i]!]: 1 }),
    );
    const plan = buildItinerary({
      destination: BUDAPEST,
      constraints: constraints({ durationDays: 1 }),
      members: foule,
    });
    expect(plan.everyoneServed).toBe(false);
  });
});

const PREFERENCES = [
  'culture',
  'nature',
  'food',
  'nightlife',
  'relax',
  'adventure',
  'shopping',
  'offbeat',
] as const;

describe('honnêteté du contenu', () => {
  it('ne cite jamais un lieu qu’il n’a pas relevé', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints({ durationDays: 5 }),
      members: [membre('a', { culture: 1, food: 1 })],
    });
    const titres = plan.days.flatMap((d) => d.slots.map((s) => s.title));
    // Aucun nom propre inventé : que des intitulés de type de moment.
    for (const titre of titres) {
      expect(titre).not.toMatch(/Trattoria|Restaurant .|Café .|Chez |Hôtel ./);
    }
  });

  it('ne programme pas ce que la destination n’offre pas', () => {
    // Milan a une note nature très basse : inutile d'y prévoir une randonnée.
    const milan = findDestination('milan')!;
    const plan = buildItinerary({
      destination: milan,
      constraints: constraints({ durationDays: 5 }),
      members: [membre('a', { nature: 1, shopping: 0.66 })],
    });
    expect(plan.axes).not.toContain('nature');
    expect(plan.axes).toContain('shopping');
  });

  it('donne une raison à chaque créneau', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints(),
      members: [membre('a', { culture: 1 })],
    });
    for (const slot of plan.days.flatMap((d) => d.slots)) {
      expect(slot.reason.length, slot.title).toBeGreaterThan(5);
    }
  });

  it('évite de programmer deux fois la même chose d’affilée', () => {
    const plan = buildItinerary({
      destination: ROME,
      constraints: constraints({ durationDays: 5 }),
      members: [membre('a', { culture: 1, food: 0.9, offbeat: 0.7 })],
    });
    const suite = plan.axes;
    const repetitions = suite.filter((axis, i) => i > 0 && axis === suite[i - 1]).length;
    expect(repetitions).toBe(0);
  });
});

describe('soirées et budget', () => {
  it('propose une soirée un jour sur deux quand le groupe aime sortir', () => {
    const plan = buildItinerary({
      destination: BUDAPEST,
      constraints: constraints({ durationDays: 5 }),
      members: [membre('a', { nightlife: 1 }), membre('b', { nightlife: 1 })],
    });
    const soirees = plan.days.filter((d) => d.slots.some((s) => s.kind === 'evening'));
    expect(soirees.length).toBeGreaterThan(0);
    expect(soirees.length).toBeLessThan(5);
    // Jamais la veille du départ.
    expect(plan.days.at(-1)!.slots.some((s) => s.kind === 'evening')).toBe(false);
  });

  it('n’impose pas de soirée à un groupe qui n’en veut pas', () => {
    const plan = buildItinerary({
      destination: BUDAPEST,
      constraints: constraints({ durationDays: 5 }),
      members: [membre('a', { culture: 1, nightlife: 0 })],
    });
    expect(plan.days.some((d) => d.slots.some((s) => s.kind === 'evening'))).toBe(false);
  });

  it('répartit une enveloppe cohérente avec le niveau de confort', () => {
    const petit = buildItinerary({
      destination: ROME,
      constraints: constraints({ comfortLevel: 'budget' }),
      members: [membre('a', { culture: 1 })],
    });
    const confortable = buildItinerary({
      destination: ROME,
      constraints: constraints({ comfortLevel: 'comfort' }),
      members: [membre('a', { culture: 1 })],
    });
    expect(confortable.totalBudgetCents).toBeGreaterThan(petit.totalBudgetCents);
    expect(petit.totalBudgetCents).toBeGreaterThan(0);
  });

  it('est déterministe', () => {
    const entree = {
      destination: BUDAPEST,
      constraints: constraints({ durationDays: 4 }),
      members: [membre('a', { food: 1 }), membre('b', { culture: 1 })],
    };
    expect(buildItinerary(entree)).toEqual(buildItinerary(entree));
  });
});
