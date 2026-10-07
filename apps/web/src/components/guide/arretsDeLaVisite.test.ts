import { describe, expect, it } from 'vitest';
import { ARRETS_DE_LA_VISITE, arretsPour, rangDeDepart, voyageDeLaVisite } from './arretsDeLaVisite';

/** Le code des écrans et des composants, tel qu'écrit. */
const SOURCES = import.meta.glob<string>(['../../routes/**/*.tsx', '../**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const ids = (contexte: Parameters<typeof arretsPour>[0]) => arretsPour(contexte).map((arret) => arret.id);

describe('les arrêts de la visite guidée', () => {
  it('sans voyage, s’arrête sur la création du premier', () => {
    expect(ids({ voyageId: null, destinationArretee: false, collaboration: true })).toEqual(['premier-voyage']);
  });

  it('avant la destination : les envies, le vote et la grille des outils', () => {
    expect(ids({ voyageId: 'v1', destinationArretee: false, collaboration: true })).toEqual([
      'nouveau',
      'inviter',
      'envies',
      'voter',
      'outils',
      'coffre',
      'depenses',
    ]);
  });

  it('une fois la destination arrêtée : Découvrir et l’itinéraire, plus de vote', () => {
    expect(ids({ voyageId: 'v1', destinationArretee: true, collaboration: true })).toEqual([
      'nouveau',
      'inviter',
      'prochain-geste',
      'decouvrir',
      'itineraire',
      'coffre',
      'depenses',
    ]);
  });

  it('sans serveur, pas d’invitation : personne ne pourrait rejoindre', () => {
    expect(ids({ voyageId: 'v1', destinationArretee: true, collaboration: false })).not.toContain('inviter');
  });

  it('mène chaque arrêt à un écran du voyage, et le désigne par un repère', () => {
    for (const arret of ARRETS_DE_LA_VISITE) {
      expect(arret.chemin('v1')).toMatch(/^\/voyages(\/v1(\/[a-z-]+)?)?$/u);
      expect(arret.cibles.length).toBeGreaterThan(0);
    }
    expect(new Set(ARRETS_DE_LA_VISITE.map((arret) => arret.id)).size).toBe(ARRETS_DE_LA_VISITE.length);
  });

  it('déjà dans le voyage, ne repart pas vers la liste pour montrer « Nouveau »', () => {
    const dedans = arretsPour({ voyageId: 'v1', destinationArretee: false, collaboration: false }, { dansLeVoyage: true });
    expect(dedans.map((arret) => arret.id)).toEqual(['envies', 'voter', 'outils', 'coffre', 'depenses']);
  });

  it('reprend à l’arrêt retenu, s’il existe encore pour ce voyage', () => {
    const arrets = arretsPour({ voyageId: 'v1', destinationArretee: false, collaboration: false });
    expect(rangDeDepart(arrets, {})).toBe(0);
    expect(arrets[rangDeDepart(arrets, { arret: 'coffre' })]!.id).toBe('coffre');
    // Un arrêt qui n'existe plus pour ce voyage : on repart du début.
    expect(rangDeDepart(arrets, { arret: 'decouvrir' })).toBe(0);
  });

  it('se joue de préférence dans un voyage dont la destination est arrêtée', () => {
    expect(voyageDeLaVisite([])).toEqual({ voyageId: null, destinationArretee: false });
    expect(voyageDeLaVisite([{ id: 'a', destinationId: null }, { id: 'b', destinationId: 'bali' }])).toEqual({
      voyageId: 'b',
      destinationArretee: true,
    });
    expect(voyageDeLaVisite([{ id: 'a' }, { id: 'c', destinationId: null }])).toEqual({
      voyageId: 'a',
      destinationArretee: false,
    });
  });

  it('trouve chaque repère dans le code des écrans', () => {
    // Retirer un `data-guide` en retouchant un écran laisserait la bulle
    // parler dans le vide : ce test le rattrape.
    const code = Object.values(SOURCES).join('\n');
    for (const arret of ARRETS_DE_LA_VISITE) {
      for (const cible of arret.cibles) {
        expect(code.includes(`data-guide="${cible}"`) || code.includes(`'${cible}' : undefined`), cible).toBe(true);
      }
    }
  });
});
