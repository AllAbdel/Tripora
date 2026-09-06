import { describe, expect, it } from 'vitest';
import { assessFreshness, freshnessLabel, weakestSource } from './freshness.js';

const NOW = new Date('2026-09-06T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

describe('fraîcheur des prix', () => {
  it('garde un prix relevé récent', () => {
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(5) };
    expect(assessFreshness(value, NOW).source).toBe('observed');
    expect(freshnessLabel(value, NOW)).toMatch(/^Prix vu le /);
  });

  it('déclasse un prix relevé trop vieux en simple estimation', () => {
    const value = { cents: 9500, source: 'observed' as const, fetchedAt: hoursAgo(100) };
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
    expect(label).toContain('Aviasales');
  });

  it('un total vaut son poste le moins fiable', () => {
    expect(weakestSource(['observed', 'estimated'])).toBe('estimated');
    expect(weakestSource(['observed', 'observed'])).toBe('observed');
    expect(weakestSource(['estimated', 'unavailable'])).toBe('unavailable');
  });
});
