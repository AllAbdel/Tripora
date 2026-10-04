import { describe, expect, it } from 'vitest';
import { localeDeFormat, paysDuNavigateur, resoudreLaRegion } from './region';

const AUTO = { devise: 'auto', temperature: 'auto', distance: 'auto' } as const;

describe('les réglages régionaux de la personne', () => {
  it('lit le pays annoncé par le navigateur', () => {
    expect(paysDuNavigateur(['en-US', 'en'])).toBe('US');
    expect(paysDuNavigateur(['fr', 'fr-FR'])).toBe('FR');
    expect(paysDuNavigateur(['fr'])).toBeNull();
  });

  it('écrit les nombres dans la langue de l’interface, précisée par le pays quand c’est la même langue', () => {
    expect(localeDeFormat('en', ['en-GB'])).toBe('en-GB');
    expect(localeDeFormat('en', ['fr-FR'])).toBe('en');
    expect(localeDeFormat('fr', ['fr-CA', 'fr'])).toBe('fr-CA');
  });

  it('en automatique, suit les usages du pays', () => {
    expect(resoudreLaRegion(AUTO, 'en', ['en-US'])).toEqual({ locale: 'en-US', devise: 'USD', temperature: 'F', distance: 'mi' });
    expect(resoudreLaRegion(AUTO, 'en', ['en-GB'])).toEqual({ locale: 'en-GB', devise: 'GBP', temperature: 'C', distance: 'mi' });
    expect(resoudreLaRegion(AUTO, 'fr', ['fr-FR'])).toEqual({ locale: 'fr-FR', devise: 'EUR', temperature: 'C', distance: 'km' });
    // Un pays dont la BCE ne publie pas la devise : on reste en euros plutôt que d'inventer un taux.
    expect(resoudreLaRegion(AUTO, 'fr', ['fr-SN']).devise).toBe('EUR');
  });

  it('laisse le choix explicite l’emporter', () => {
    expect(resoudreLaRegion({ devise: 'CHF', temperature: 'K', distance: 'km' }, 'en', ['en-US'])).toMatchObject({
      devise: 'CHF',
      temperature: 'K',
      distance: 'km',
    });
  });
});
