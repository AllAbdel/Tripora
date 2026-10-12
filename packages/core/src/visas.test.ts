import { describe, expect, it } from 'vitest';
import { PAYS_DES_VISAS, VISAS_DU_MONDE } from './visas-du-monde.js';
import { RELEVE_DES_VISAS, exigenceDeVisa } from './visas.js';

describe('les formalités d’entrée (Passport Index Data)', () => {
  it('une ligne par passeport, une lettre par pays', () => {
    const pays = PAYS_DES_VISAS.split(' ');
    expect(pays.length).toBeGreaterThan(190);
    expect(RELEVE_DES_VISAS).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    for (const [passeport, ligne] of Object.entries(VISAS_DU_MONDE)) {
      expect(ligne.match(/[A-Z-]/gu)?.length, passeport).toBe(pays.length);
    }
  });

  it('lit la formalité et la durée du séjour', () => {
    // Un Français : sans visa au Maroc (90 jours), ESTA aux États-Unis.
    expect(exigenceDeVisa('FR', 'MA')).toEqual({ formalite: 'sans-visa', jours: 90 });
    expect(exigenceDeVisa('fr', 'us')?.formalite).toBe('autorisation-electronique');
    // Un Marocain a besoin d'un visa pour la France.
    expect(exigenceDeVisa('MA', 'FR')?.formalite).toBe('visa');
  });

  it('se tait plutôt que de deviner', () => {
    expect(exigenceDeVisa('FR', 'FR')).toBeUndefined();
    // La Réunion n'est pas un pays de la source.
    expect(exigenceDeVisa('FR', 'RE')).toBeUndefined();
    expect(exigenceDeVisa('XX', 'MA')).toBeUndefined();
    expect(exigenceDeVisa(undefined, 'MA')).toBeUndefined();
  });
});
