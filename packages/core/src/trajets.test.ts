import { describe, expect, it } from 'vitest';
import { detaillerTrajet, estimateTransportOptions } from './transport.js';
import { describeSource } from './freshness.js';
import type { PricedValue } from './freshness.js';

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['CDG'] };
const ROME = { name: 'Rome', lat: 41.9028, lng: 12.4964, iata: ['FCO'] };
const LYON = { name: 'Lyon', lat: 45.764, lng: 4.8357 };

function volAvec(prix: Partial<PricedValue>) {
  const options = estimateTransportOptions(PARIS, ROME, 4);
  const vol = options.find((option) => option.mode === 'plane')!;
  return { ...vol, price: { ...vol.price, ...prix } };
}

describe('détail d’un trajet', () => {
  it('découpe un vol en transfert, vol, transfert', () => {
    const detail = detaillerTrajet(PARIS, ROME, volAvec({}));
    expect(detail.etapes.map((e) => e.nature)).toEqual(['transfert', 'vol', 'transfert']);
    expect(detail.etapes[1]?.depuis).toBe('Paris (CDG)');
    expect(detail.etapes[1]?.vers).toBe('Rome (FCO)');
  });

  it('n’annonce jamais un vol direct qu’on ne connaît pas', () => {
    // Le pire mensonge possible : quelqu'un réserve en croyant à un sans escale.
    const detail = detaillerTrajet(PARIS, ROME, volAvec({}));
    expect(detail.escales).toBeNull();
    expect(detail.precision).toContain('Escales inconnues');
  });

  it('annonce le direct quand la source le dit', () => {
    const detail = detaillerTrajet(PARIS, ROME, volAvec({ stops: 0 }));
    expect(detail.escales).toBe(0);
    expect(detail.precision).toContain('direct');
  });

  it('compte les escales, sans prétendre en connaître la ville', () => {
    const une = detaillerTrajet(PARIS, ROME, volAvec({ stops: 1 }));
    expect(une.precision).toContain('Une escale');
    expect(une.precision).toContain('n’en indique pas la ville');

    const deux = detaillerTrajet(PARIS, ROME, volAvec({ stops: 2 }));
    expect(deux.precision).toContain('2 escales');
  });

  it('dit qu’il ne connaît pas les correspondances d’un train', () => {
    const train = estimateTransportOptions(PARIS, LYON, 2).find((o) => o.mode === 'train')!;
    const detail = detaillerTrajet(PARIS, LYON, train);
    expect(detail.escales).toBeNull();
    expect(detail.precision).toContain('Correspondances non connues');
    expect(detail.etapes).toHaveLength(1);
  });

  it('n’invente pas de code d’aéroport là où il n’y en a pas', () => {
    const detail = detaillerTrajet(PARIS, LYON, volAvec({ stops: 0 }));
    expect(detail.etapes[1]?.vers).toBe('Lyon');
  });

  it('donne des durées d’aller, pas d’aller-retour', () => {
    const vol = volAvec({});
    const detail = detaillerTrajet(PARIS, ROME, vol);
    const total = detail.etapes.reduce((somme, etape) => somme + etape.dureeMin, 0);
    expect(total).toBeLessThanOrEqual(Math.round(vol.durationMin / 2));
  });
});

describe('provenance d’un prix', () => {
  const releve: PricedValue = {
    cents: 18_900,
    source: 'observed',
    provider: 'Aviasales',
    fetchedAt: new Date().toISOString(),
  };

  it('nomme le site où le prix a été vu', () => {
    expect(describeSource(releve).long).toContain('Aviasales');
    expect(describeSource(releve).releve).toBe(true);
  });

  it('nomme aussi le revendeur, qui n’est pas l’agrégateur', () => {
    const avecRevendeur = { ...releve, reseller: 'Trip.com' };
    expect(describeSource(avecRevendeur).long).toContain('vendu par Trip.com');
  });

  it('dit clairement quand personne n’a été consulté', () => {
    const estime: PricedValue = { cents: 15_000, source: 'estimated' };
    const provenance = describeSource(estime);
    expect(provenance.releve).toBe(false);
    expect(provenance.long).toContain('Aucun site n’a été consulté');
  });

  it('déclasse un relevé trop vieux plutôt que de le présenter comme vu', () => {
    const vieux: PricedValue = {
      ...releve,
      fetchedAt: new Date(Date.now() - 30 * 24 * 3_600_000).toISOString(),
    };
    expect(describeSource(vieux).releve).toBe(false);
  });

  it('donne les dates du trajet relevé quand la source les fournit', () => {
    const date = describeSource({
      ...releve,
      departAt: '2026-07-12',
      returnAt: '2026-07-24',
    }).long;
    expect(date).toContain('aller le 12 juil.');
    expect(date).toContain('retour le 24 juil.');
  });
});
