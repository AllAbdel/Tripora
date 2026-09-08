import { beforeEach, describe, expect, it } from 'vitest';
import { depotLocal } from './trips';
import type { TripDraft } from '@/stores/tripDraft';

/**
 * Le voyage dont on sait déjà où il va.
 *
 * C'est le cas qui était cassé de bout en bout : on choisissait Bali, et
 * l'écran du voyage affichait une liste de villes françaises. Trois causes,
 * une par couche, et un test par cause.
 */

const BROUILLON: TripDraft = {
  title: 'Bali entre potes',
  groupType: 'friends',
  participants: 4,
  origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['CDG'] },
  destinationMode: 'fixed',
  destinationIds: ['bali', 'lombok'],
  dateMode: 'month',
  startDate: null,
  endDate: null,
  windowStart: null,
  windowEnd: null,
  month: 7,
  durationDays: 12,
  budgetMode: 'max_per_person',
  budgetPerPersonCents: 180_000,
  comfortLevel: 'mid',
  weights: { nature: 1, relax: 0.66 },
  avoid: [],
};

function poser(brouillon: TripDraft): void {
  localStorage.setItem(
    'tripora.local-trips',
    JSON.stringify([
      { id: 'v1', title: brouillon.title, createdAt: '2026-09-08T10:00:00.000Z', draft: brouillon },
    ]),
  );
}

describe('voyage à destination choisie', () => {
  beforeEach(() => localStorage.clear());

  it('retient la destination choisie sans attendre le moindre vote', async () => {
    poser(BROUILLON);
    const voyage = await depotLocal.get('v1');
    // Avant la correction : `null`, parce que seule une destination votée
    // comptait. Le voyage s'affichait donc comme s'il n'en avait pas.
    expect(voyage?.lockedDestinationId).toBe('bali');
    expect(voyage?.summary.status).toBe('planned');
  });

  it('garde toutes les étapes, pas seulement la première', async () => {
    poser(BROUILLON);
    const voyage = await depotLocal.get('v1');
    // L'écran de création annonce qu'un voyage peut enchaîner plusieurs
    // villes : les perdre en silence est pire que de ne pas le proposer.
    expect(voyage?.shortlist).toEqual(['bali', 'lombok']);
  });

  it('se déclare « choisi » et non « à comparer »', async () => {
    poser(BROUILLON);
    const voyage = await depotLocal.get('v1');
    expect(voyage?.destinationMode).toBe('fixed');
  });

  it('laisse le mode « surprends-nous » sans destination ni étapes', async () => {
    poser({ ...BROUILLON, destinationMode: 'suggest', destinationIds: [] });
    const voyage = await depotLocal.get('v1');
    expect(voyage?.destinationMode).toBe('suggest');
    expect(voyage?.shortlist).toEqual([]);
    expect(voyage?.lockedDestinationId).toBeNull();
  });

  it('ne retient rien des villes cochées puis abandonnées', async () => {
    // Le mode fait foi : cocher des villes puis repasser en « surprends-nous »
    // ne doit pas laisser un voyage à moitié décidé.
    poser({ ...BROUILLON, destinationMode: 'suggest' });
    const voyage = await depotLocal.get('v1');
    expect(voyage?.shortlist).toEqual([]);
    expect(voyage?.lockedDestinationId).toBeNull();
  });
});
