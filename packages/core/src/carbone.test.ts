import { describe, expect, it } from 'vitest';
import {
  empreinteDuTrajet,
  kgLisibles,
  partDeLObjectif,
  phraseDeComparaison,
  type EmpreinteDuTrajet,
} from './carbone.js';
import { haversineKm } from './geo.js';

const PARIS = { lat: 48.8566, lng: 2.3522 };
const MARSEILLE = { lat: 43.2965, lng: 5.3698 };
const LISBONNE = { lat: 38.7223, lng: -9.1393 };
const BANGKOK = { lat: 13.7563, lng: 100.5018 };

describe('l’empreinte carbone d’un trajet', () => {
  it('reprend les facteurs de l’ADEME, aller et retour compris', () => {
    const direct = haversineKm(PARIS, LISBONNE);
    // Moyen-courrier (1 001 à 2 000 km) : 0,184661 kg par km, deux fois.
    const avion = empreinteDuTrajet('plane', PARIS, LISBONNE)!;
    expect(avion.kg).toBe(Math.round((direct * 2 * 0.184661) / 10) * 10);
    expect(avion.source).toContain('traînées');
  });

  it('change de facteur avec la distance du vol', () => {
    const court = empreinteDuTrajet('plane', PARIS, MARSEILLE)!;
    const long = empreinteDuTrajet('plane', PARIS, BANGKOK)!;
    const parKm = (kg: number, a: typeof PARIS, b: typeof PARIS) => kg / (haversineKm(a, b) * 2);
    // Un court-courrier émet plus par kilomètre qu'un long : le décollage pèse.
    expect(parKm(court.kg, PARIS, MARSEILLE)).toBeGreaterThan(parKm(long.kg, PARIS, BANGKOK));
    expect(long.kg).toBeGreaterThan(3000);
  });

  it('ne donne au train le chiffre du TGV qu’en France', () => {
    const france = empreinteDuTrajet('train', PARIS, MARSEILLE, { enFrance: true })!;
    const europe = empreinteDuTrajet('train', PARIS, MARSEILLE)!;
    expect(france.source).toContain('TGV');
    expect(europe.source).toContain('européen');
    expect(europe.kg).toBeGreaterThan(france.kg * 10);
    // Même à l'étranger, le train reste loin devant l'avion.
    expect(europe.kg * 4).toBeLessThan(empreinteDuTrajet('plane', PARIS, MARSEILLE)!.kg);
  });

  it('partage la voiture entre ses occupants, jusqu’à cinq', () => {
    const seul = empreinteDuTrajet('car', PARIS, MARSEILLE, { participants: 1 })!;
    const quatre = empreinteDuTrajet('car', PARIS, MARSEILLE, { participants: 4 })!;
    const douze = empreinteDuTrajet('car', PARIS, MARSEILLE, { participants: 12 })!;
    expect(quatre.kg).toBeCloseTo(seul.kg / 4, -1);
    expect(douze.kg).toBe(empreinteDuTrajet('car', PARIS, MARSEILLE, { participants: 5 })!.kg);
    expect(quatre.source).toContain('partagée à 4');
  });

  it('n’invente rien pour le ferry', () => {
    expect(empreinteDuTrajet('ferry', PARIS, LISBONNE)).toBeNull();
  });
});

describe('ce qu’on en dit', () => {
  it('écrit des masses lisibles', () => {
    expect(kgLisibles(2.9)).toBe('2,9 kg');
    expect(kgLisibles(380)).toBe('380 kg');
    expect(kgLisibles(3460)).toBe('3,5 t');
    expect(partDeLObjectif(500)).toBe(25);
  });

  it('compare l’avion au meilleur trajet au sol, quand l’écart compte', () => {
    const empreintes: EmpreinteDuTrajet[] = [
      { mode: 'plane', kg: 300, source: '' },
      { mode: 'train', kg: 10, source: '' },
      { mode: 'bus', kg: 60, source: '' },
    ];
    expect(phraseDeComparaison(empreintes)).toBe(
      'En train plutôt qu’en avion : 290 kg de CO₂e de moins par personne (30 fois moins).',
    );
    // Pas d'avion, ou un écart négligeable : rien à dire.
    expect(phraseDeComparaison(empreintes.slice(1))).toBeNull();
    expect(
      phraseDeComparaison([
        { mode: 'plane', kg: 40, source: '' },
        { mode: 'bus', kg: 30, source: '' },
      ]),
    ).toBeNull();
  });
});

describe('le trajet en France', () => {
  it('se reconnaît au pays du départ, écrit ou déduit, et à celui de l’arrivée', async () => {
    const { trajetEnFrance } = await import('./carbone.js');
    expect(trajetEnFrance({ ...PARIS, country: 'France' }, { countryCode: 'FR' })).toBe(true);
    // Une position sans pays : Lyon est à côté, c'est la France.
    expect(trajetEnFrance({ lat: 45.771, lng: 4.88 }, { countryCode: 'FR' })).toBe(true);
    expect(trajetEnFrance({ ...PARIS, country: 'France' }, { countryCode: 'PT' })).toBe(false);
    expect(trajetEnFrance({ lat: 50.85, lng: 4.35, country: 'Belgique' }, { countryCode: 'FR' })).toBe(false);
  });
});
