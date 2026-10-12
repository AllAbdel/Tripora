import { describe, expect, it } from 'vitest';
import {
  aeroportsAComparer,
  chercherDepartsPays,
  estUnDepartPays,
  nomDeLAeroport,
  ORIGINS,
} from './origins.js';

const ville = (nom: string) => {
  const trouvee = ORIGINS.find((place) => place.name === nom);
  if (!trouvee) throw new Error(nom);
  return trouvee;
};

describe('partir de tout un pays, ou du meilleur aéroport voisin', () => {
  it('propose « France (tous les aéroports) » dès qu’on tape le pays', () => {
    const [france] = chercherDepartsPays('fra');
    expect(france?.name).toBe('France (tous les aéroports)');
    expect(france && estUnDepartPays(france)).toBe(true);
    // Les grandes plateformes, et Beauvais pour les compagnies à bas prix.
    expect(france?.iata).toEqual(['PAR', 'BVA', 'LYS', 'MRS', 'NCE', 'BOD', 'TLS', 'NTE']);
    // Rien pour une saisie trop courte, ni pour un pays sans deux aéroports connus.
    expect(chercherDepartsPays('f')).toEqual([]);
    expect(estUnDepartPays(ville('Lyon'))).toBe(false);
  });

  it('compare la ville et ses voisines : de Lyon, Grenoble et Genève', () => {
    const codes = aeroportsAComparer(ville('Lyon'));
    expect(codes[0]).toBe('LYS');
    expect(codes).toContain('GNB');
    expect(codes).toContain('GVA');
    expect(codes.length).toBeLessThanOrEqual(5);
    // Un départ « tout le pays » compare déjà les siens, sans voisins en plus.
    const [france] = chercherDepartsPays('France');
    expect(aeroportsAComparer(france!)).toEqual(france!.iata);
  });

  it('nomme un aéroport par sa ville, ou par son nom quand la ville en a plusieurs', () => {
    expect(nomDeLAeroport('NTE')).toBe('Nantes');
    expect(nomDeLAeroport('PAR')).toBe('Paris');
    expect(nomDeLAeroport('BVA')).toBe('Paris-Beauvais');
    expect(nomDeLAeroport('XYZ')).toBe('XYZ');
  });
});
