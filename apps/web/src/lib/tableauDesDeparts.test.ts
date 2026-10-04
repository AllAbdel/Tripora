import { describe, expect, it } from 'vitest';
import { nomCourt, tableauDesDeparts } from './tableauDesDeparts';

describe('tableau des départs', () => {
  const LUNDI = new Date('2026-09-21T08:00:00Z');
  const MARDI = new Date('2026-09-22T08:00:00Z');

  it('donne le même tableau toute la journée', () => {
    // Deux rendus du même jour — un retour en arrière, un changement de
    // thème — ne doivent pas rebattre les cartes sous les yeux.
    const matin = tableauDesDeparts(5, new Date('2026-09-21T06:12:00Z'));
    const soir = tableauDesDeparts(5, new Date('2026-09-21T23:48:00Z'));
    expect(soir).toEqual(matin);
  });

  it('change le lendemain', () => {
    expect(tableauDesDeparts(5, MARDI)).not.toEqual(tableauDesDeparts(5, LUNDI));
  });

  it('n’annonce jamais deux fois le même pays', () => {
    // Un tableau qui affiche Lisbonne, Porto et Faro promet une région, pas
    // un monde. On vérifie sur une semaine, pas sur un seul tirage.
    for (let decalage = 0; decalage < 7; decalage += 1) {
      const jour = new Date(LUNDI.getTime() + decalage * 86_400_000);
      const lignes = tableauDesDeparts(5, jour);
      const pays = lignes.map((ligne) => ligne.pays).filter(Boolean);
      expect(new Set(pays).size, jour.toISOString()).toBe(pays.length);
    }
  });

  it('ne montre que de vrais codes d’aéroport', () => {
    for (const ligne of tableauDesDeparts(5, LUNDI)) {
      expect(ligne.code).toMatch(/^[A-Z]{3}$/);
      expect(ligne.ville.length).toBeGreaterThan(2);
    }
  });

  it('ne répète pas le nom quand la ville est le pays', () => {
    // « SIN · Singapour · SINGAPOUR » : aucun tableau d'aéroport n'écrit deux
    // fois le même mot sur une ligne.
    for (let decalage = 0; decalage < 30; decalage += 1) {
      const jour = new Date(LUNDI.getTime() + decalage * 86_400_000);
      for (const ligne of tableauDesDeparts(5, jour)) {
        expect(ligne.pays.toLowerCase()).not.toBe(ligne.ville.toLowerCase());
      }
    }
  });

  it('annonce une ville, pas un programme', () => {
    // Le catalogue intitule : « Caen et les plages du Débarquement ». Un
    // tableau de départs affiche « Caen ».
    expect(nomCourt('Caen et les plages du Débarquement')).toBe('Caen');
    expect(nomCourt('Sumatra — Medan et le lac Toba')).toBe('Sumatra');
    expect(nomCourt('Lisbonne')).toBe('Lisbonne');
  });
});
