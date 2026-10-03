import { describe, expect, it } from 'vitest';
import { nettoyer, pageSansIdentifiant } from './remonterLesErreurs';

describe('ce qui part avec une erreur', () => {
  it('perd les adresses e-mail, les identifiants et les paramètres d’adresse', () => {
    expect(nettoyer('Échec pour lea.martin+test@exemple.fr')).toBe('Échec pour <e-mail>');
    expect(nettoyer('Voyage 3f2b8c1e-9a4d-4e2b-8c1e-9a4d4e2b8c1e introuvable')).toBe('Voyage :id introuvable');
    expect(nettoyer('GET https://x.supabase.co/rest/v1/trips?id=eq.42&select=*')).toBe(
      'GET https://x.supabase.co/rest/v1/trips?…',
    );
    expect(nettoyer('IBAN FR76 3000 6000 0112 3456 7890 189 refusé')).toContain('<iban>');
    expect(nettoyer('Code K7Q2M9XA expiré')).toBe('Code <code> expiré');
    expect(nettoyer('Appel au 0612345678')).toBe('Appel au <nombre>');
  });

  it('garde le message technique lisible', () => {
    expect(nettoyer("Cannot read properties of undefined (reading 'name')")).toBe(
      "Cannot read properties of undefined (reading 'name')",
    );
    expect(nettoyer('TypeError: TRIPORA is not defined')).toBe('TypeError: TRIPORA is not defined');
  });

  it('nomme la page sans ses identifiants', () => {
    expect(pageSansIdentifiant('/voyages/3f2b8c1e-9a4d-4e2b-8c1e-9a4d4e2b8c1e/budget')).toBe('/voyages/:id/budget');
    expect(pageSansIdentifiant('/voyages/v12/carte')).toBe('/voyages/:id/carte');
    expect(pageSansIdentifiant('/profil')).toBe('/profil');
  });
});
