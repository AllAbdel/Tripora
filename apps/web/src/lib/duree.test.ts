import { describe, expect, it } from 'vitest';
import { direLaDuree } from './duree';

describe('dire une durée', () => {
  it('dit les heures rondes sans minutes', () => {
    expect(direLaDuree(3)).toBe('3 h');
    expect(direLaDuree(1)).toBe('1 h');
  });

  it('dit les demies en minutes', () => {
    expect(direLaDuree(1.5)).toBe('1 h 30');
    expect(direLaDuree(2.25)).toBe('2 h 15');
    expect(direLaDuree(3.75)).toBe('3 h 45');
  });

  it('passe aux jours au-delà d’une nuit sur place', () => {
    // Le trek du Rinjani dure trente-six heures : « 36 h » ne se lit pas.
    expect(direLaDuree(36)).toBe('2 jours');
    expect(direLaDuree(24)).toBe('1 jour');
    expect(direLaDuree(48)).toBe('2 jours');
  });

  it('dit une demi-heure en minutes seules', () => {
    expect(direLaDuree(0.5)).toBe('30 min');
  });

  it('ne produit jamais « 0 h » ni de minutes à rallonge', () => {
    for (let heures = 0.5; heures <= 48; heures += 0.25) {
      const dit = direLaDuree(heures);
      expect(dit, String(heures)).not.toMatch(/^0 h/u);
      expect(dit, String(heures)).not.toMatch(/\d{3,}/u);
    }
  });
});
