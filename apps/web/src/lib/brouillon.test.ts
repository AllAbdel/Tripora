import { describe, expect, it, vi } from 'vitest';
import type { PreferenceAxis, TripDraft as AiDraft } from '@tripora/core';
import { appliquerBrouillon, resumer } from './brouillon';
import type { TripDraft as StoreTripDraft } from '@/stores/tripDraft';

function cible() {
  const patch = vi.fn<(values: Partial<StoreTripDraft>) => void>();
  const setWeight = vi.fn<(axis: PreferenceAxis, value: number) => void>();
  const applique = (brouillon: AiDraft) => {
    appliquerBrouillon(brouillon, { patch, setWeight });
    return Object.assign({}, ...patch.mock.calls.map(([values]) => values)) as Partial<StoreTripDraft>;
  };
  return { applique, setWeight };
}

describe('report d’un brouillon dans le formulaire', () => {
  it('résout un nom de ville en point de départ complet', () => {
    const { applique } = cible();
    const valeurs = applique({ origin: 'Lyon' });
    expect(valeurs.origin?.name).toBe('Lyon');
    // Sans coordonnées ni code d'aéroport, le calcul de prix et de distance
    // n'aurait rien à se mettre sous la dent.
    expect(valeurs.origin?.lat).toBeGreaterThan(45);
    expect(valeurs.origin?.iata?.length).toBeGreaterThan(0);
  });

  it('trouve la ville même sans accent ni majuscule', () => {
    const { applique } = cible();
    expect(applique({ destination: 'seville' }).destinationIds).toEqual(['seville']);
  });

  it('ignore une ville qu’aucun catalogue ne connaît', () => {
    const { applique } = cible();
    const valeurs = applique({ destination: 'Vulcania', origin: 'Atlantide' });
    expect(valeurs.origin).toBeUndefined();
    expect(valeurs.destinationIds).toBeUndefined();
    // Et surtout, le mode ne bascule pas sur « destination fixée » à vide :
    // l'écran proposerait alors un voyage vers nulle part.
    expect(valeurs.destinationMode).toBeUndefined();
  });

  it('passe en mode « destination fixée » quand une ville est reconnue', () => {
    const { applique } = cible();
    const valeurs = applique({ destination: 'Rome' });
    expect(valeurs.destinationMode).toBe('fixed');
    expect(valeurs.destinationIds).toEqual(['rome']);
  });

  it('accorde le mode de date et le mode de budget avec ce qui est dit', () => {
    const { applique } = cible();
    const valeurs = applique({ month: 10, budgetPerPersonCents: 40_000 });
    expect(valeurs.month).toBe(10);
    expect(valeurs.dateMode).toBe('month');
    expect(valeurs.budgetPerPersonCents).toBe(40_000);
    expect(valeurs.budgetMode).toBe('max_per_person');
  });

  it('ne touche à rien de ce qui n’a pas été dit', () => {
    const { applique } = cible();
    expect(Object.keys(applique({ participants: 5 }))).toEqual(['participants']);
  });

  it('reporte les envies une par une', () => {
    const { applique, setWeight } = cible();
    applique({ weights: { food: 1, nightlife: 0.5 } });
    expect(setWeight).toHaveBeenCalledWith('food', 1);
    expect(setWeight).toHaveBeenCalledWith('nightlife', 0.5);
    expect(setWeight).toHaveBeenCalledTimes(2);
  });
});

describe('résumé de ce qui a été compris', () => {
  it('énumère en français ce que la personne pourra démentir', () => {
    const lignes = resumer({
      participants: 5,
      origin: 'Lyon',
      durationDays: 7,
      month: 10,
      budgetPerPersonCents: 40_000,
      comfortLevel: 'budget',
      groupType: 'friends',
      weights: { food: 1 },
    });
    expect(lignes).toHaveLength(8);
    expect(lignes.slice(0, 4)).toEqual([
      '5 personnes',
      'départ de Lyon',
      '7 jours',
      'en octobre',
    ]);
    // Intl sépare le montant du symbole par une espace insécable étroite : on
    // vérifie le sens, pas l'octet exact.
    expect(lignes[4]).toMatch(/^400\s?€ max$/u);
    expect(lignes.slice(5)).toEqual(['petit budget', 'entre amis', 'Gastronomie']);
  });

  it('ne mentionne pas une envie explicitement écartée', () => {
    expect(resumer({ weights: { food: 0 } })).toEqual([]);
  });

  it('ne dit rien d’un brouillon vide', () => {
    expect(resumer({})).toEqual([]);
  });
});
