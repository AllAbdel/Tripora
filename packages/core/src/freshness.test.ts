import { describe, expect, it } from 'vitest';
import { assessFreshness, freshnessLabel, weakestSource } from './freshness.js';

const NOW = new Date('2026-09-06T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('fraîcheur des prix', () => {
  it('garde un prix relevé récent', () => {
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(5) };
    expect(assessFreshness(value, NOW).source).toBe('observed');
    expect(freshnessLabel(value, NOW)).toBe('Prix vu aujourd’hui');
  });

  it('dit depuis quand en clair, pas en date à décoder', () => {
    expect(freshnessLabel({ cents: 100, source: 'observed', fetchedAt: hoursAgo(30) }, NOW))
      .toBe('Prix vu hier');
    expect(freshnessLabel({ cents: 100, source: 'observed', fetchedAt: hoursAgo(24 * 4) }, NOW))
      .toBe('Prix vu il y a 4 jours');
    // Au-delà d'une semaine, le décompte cesse d'être parlant.
    expect(freshnessLabel({ cents: 100, source: 'observed', fetchedAt: hoursAgo(24 * 10) }, NOW))
      .toMatch(/^Prix vu le /);
  });

  it('garde le statut « relevé » sur toute la fenêtre utile du cache', () => {
    // Le cache Aviasales remonte des relevés de plusieurs jours : les classer
    // « indicatifs » les confondrait avec nos propres estimations.
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(24 * 5) };
    expect(assessFreshness(value, NOW).source).toBe('observed');
  });

  it('déclasse un prix relevé trop vieux en simple estimation', () => {
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(24 * 20) };
    expect(assessFreshness(value, NOW).source).toBe('estimated');
    expect(freshnessLabel(value, NOW)).toBe('Prix indicatif');
  });

  it('déclasse un prix relevé sans date', () => {
    expect(assessFreshness({ cents: 100, source: 'observed' }, NOW).source).toBe('estimated');
  });

  it('affiche « non disponible » quand il n’y a pas de montant', () => {
    expect(freshnessLabel({ cents: null, source: 'observed' }, NOW)).toBe('Prix non disponible');
  });

  it('cite la source quand elle est connue', () => {
    const label = freshnessLabel(
      { cents: 9500, source: 'observed', fetchedAt: hoursAgo(2), provider: 'Aviasales' },
      NOW,
    );
    expect(label).toBe('Prix vu aujourd’hui (Aviasales)');
  });

  it('un total vaut son poste le moins fiable', () => {
    expect(weakestSource(['observed', 'estimated'])).toBe('estimated');
    expect(weakestSource(['observed', 'observed'])).toBe('observed');
    expect(weakestSource(['estimated', 'unavailable'])).toBe('unavailable');
  });
});
