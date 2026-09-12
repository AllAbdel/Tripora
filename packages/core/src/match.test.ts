import { describe, expect, it } from 'vitest';
import { correspondanceAuxEnvies } from './match.js';
import { normalizeWeights } from './preferences.js';
import { findDestination } from './catalog/destinations.js';
import type { Destination, MemberPreference } from './types.js';

const BALI = findDestination('bali') as Destination;

function membre(poids: Record<string, number>, avoid: string[] = []): MemberPreference {
  return {
    userId: 'moi',
    weights: normalizeWeights(poids),
    budgetMaxCents: null,
    avoid: avoid as MemberPreference['avoid'],
  };
}

describe('correspondance aux envies', () => {
  it('ne parle que des envies réellement exprimées', () => {
    const { axes } = correspondanceAuxEnvies(BALI, [membre({ nature: 1, food: 0.66 })]);
    expect(axes.map((axe) => axe.axis)).toEqual(['nature', 'food']);
  });

  it('classe de l’envie la plus forte à la plus faible', () => {
    const { axes } = correspondanceAuxEnvies(BALI, [
      membre({ shopping: 0.33, nature: 1, culture: 0.66 }),
    ]);
    expect(axes.map((axe) => axe.axis)).toEqual(['nature', 'culture', 'shopping']);
  });

  it('rapporte l’offre à la demande, et pas à l’absolu', () => {
    // Une même ville, deux lectures : ce qui suffit à qui en voulait un peu
    // ne suffit pas à qui en faisait une condition.
    const ville: Destination = { ...BALI, tags: { ...BALI.tags, nightlife: 0.5 } };
    const beaucoup = correspondanceAuxEnvies(ville, [membre({ nightlife: 1 })]);
    const unPeu = correspondanceAuxEnvies(ville, [membre({ nightlife: 1 / 3 })]);
    expect(beaucoup.axes[0]?.couverture).toBe(50);
    expect(beaucoup.axes[0]?.verdict).toBe('faible');
    expect(unPeu.axes[0]?.couverture).toBe(100);
    expect(unPeu.axes[0]?.verdict).toBe('comble');
  });

  it('ne dépasse jamais cent pour cent', () => {
    const ville: Destination = { ...BALI, tags: { ...BALI.tags, relax: 1 } };
    const { axes, couvertureGlobale } = correspondanceAuxEnvies(ville, [membre({ relax: 0.2 })]);
    expect(axes[0]?.couverture).toBe(100);
    expect(couvertureGlobale).toBeLessThanOrEqual(100);
  });

  it('signale ce qu’on voulait éviter et qu’on trouvera quand même', () => {
    const ville: Destination = { ...BALI, tags: { ...BALI.tags, nightlife: 0.9 } };
    const { rejets } = correspondanceAuxEnvies(ville, [membre({ nature: 1 }, ['nightlife'])]);
    expect(rejets).toHaveLength(1);
    expect(rejets[0]?.phrase).toContain('vouliez l’éviter'.replace('’', "'"));
  });

  it('ne signale pas un rejet que la ville ne sert pas', () => {
    const ville: Destination = { ...BALI, tags: { ...BALI.tags, nightlife: 0.1 } };
    const { rejets } = correspondanceAuxEnvies(ville, [membre({ nature: 1 }, ['nightlife'])]);
    expect(rejets).toEqual([]);
  });

  it('nomme ce qui manque dans le résumé', () => {
    const ville: Destination = { ...BALI, tags: { ...BALI.tags, shopping: 0.1 } };
    const { resume } = correspondanceAuxEnvies(ville, [membre({ shopping: 1, nature: 1 })]);
    expect(resume).toContain('Ce qui manque');
    expect(resume.toLowerCase()).toContain('shopping');
  });

  it('reste muet quand personne n’a rien renseigné', () => {
    const vide = correspondanceAuxEnvies(BALI, [membre({})]);
    expect(vide.axes).toEqual([]);
    expect(vide.couvertureGlobale).toBe(0);
    expect(vide.resume).toContain('Aucune envie');
  });

  it('fait la moyenne des envies du groupe, pas celles du créateur', () => {
    const seul = correspondanceAuxEnvies(BALI, [membre({ nightlife: 1 })]);
    const aDeux = correspondanceAuxEnvies(BALI, [membre({ nightlife: 1 }), membre({})]);
    expect(aDeux.axes[0]?.envie).toBeCloseTo(0.5, 5);
    expect(aDeux.axes[0]?.couverture).toBeGreaterThan(seul.axes[0]!.couverture);
  });
});
