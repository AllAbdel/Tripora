import { afterEach, describe, expect, it } from 'vitest';
import {
  formatCents,
  formatDate,
  formatDistance,
  formatEcartDeTemperature,
  formatNombre,
  formatTaille,
  formatTemperature,
  REGION_PAR_DEFAUT,
  reglerLaRegion,
  unitesDuPays,
} from './regional.js';

// Les espaces que met Intl (insécables, fines) deviennent des espaces simples, pour comparer.
const lisible = (texte: string) => texte.replace(/[\u00a0\u202f]/gu, ' ');

afterEach(() => reglerLaRegion({ ...REGION_PAR_DEFAUT }));

describe('les réglages régionaux', () => {
  it('écrit à la française par défaut', () => {
    expect(lisible(formatCents(145000, 'EUR', { hideCentimes: true }))).toBe('1 450 €');
    expect(lisible(formatTemperature(23.6))).toBe('24 °C');
    expect(lisible(formatDistance(1234.4))).toBe('1 234 km');
    expect(lisible(formatNombre(1234.5))).toBe('1 234,5');
    expect(formatDate('2026-10-02T12:00:00Z', { day: 'numeric', month: 'long' })).toBe('2 octobre');
  });

  it('suit la langue, la devise et les unités choisies', () => {
    reglerLaRegion({ locale: 'en-US', devise: 'USD', temperature: 'F', distance: 'mi', tauxDeLaDevise: 1.1 });
    // Une estimation en euros se convertit, et le dit.
    expect(formatCents(100000, 'EUR', { hideCentimes: true })).toBe('≈ $1,100');
    // Une somme réelle garde sa devise.
    expect(formatCents(100000, 'EUR', { sansConversion: true })).toBe('€1,000.00');
    expect(formatTemperature(24)).toBe('75 °F');
    expect(formatEcartDeTemperature(10)).toBe('18 °F');
    expect(formatDistance(1609.344)).toBe('1,000 mi');
    expect(formatDate('2026-10-02T12:00:00Z', { day: 'numeric', month: 'long' })).toBe('October 2');
  });

  it('ne convertit pas sans taux du jour', () => {
    reglerLaRegion({ locale: 'en-US', devise: 'USD', tauxDeLaDevise: null });
    expect(formatCents(100000, 'EUR', { hideCentimes: true })).toBe('€1,000');
  });

  it('compte en kelvins', () => {
    reglerLaRegion({ temperature: 'K' });
    expect(lisible(formatTemperature(20))).toBe('293 K');
    expect(lisible(formatEcartDeTemperature(10))).toBe('10 K');
  });

  it('connaît les unités d’usage d’un pays', () => {
    expect(unitesDuPays('US')).toEqual({ temperature: 'F', distance: 'mi' });
    expect(unitesDuPays('GB')).toEqual({ temperature: 'C', distance: 'mi' });
    expect(unitesDuPays('AU')).toEqual({ temperature: 'C', distance: 'km' });
    expect(unitesDuPays(null)).toEqual({ temperature: 'C', distance: 'km' });
  });
});

describe('les tailles de fichier', () => {
  it('s’écrivent dans la langue de la personne', () => {
    expect(lisible(formatTaille(9.4 * 1024 * 1024))).toBe('9 Mo');
    reglerLaRegion({ locale: 'en-US' });
    expect(formatTaille(200)).toBe('1 MB');
  });
});
