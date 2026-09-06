import { describe, expect, it } from 'vitest';
import { groupChoice, preferenceScore, type VoteTally } from './votes';

function tally(overrides: Partial<VoteTally> & { destinationId: string }): VoteTally {
  return { likes: 0, dislikes: 0, favorites: 0, mine: null, ...overrides };
}

describe('poids d’un vote', () => {
  it('compte un favori double : c’est une préférence appuyée, pas un accord poli', () => {
    expect(preferenceScore(tally({ destinationId: 'a', likes: 2 }))).toBe(2);
    expect(preferenceScore(tally({ destinationId: 'a', favorites: 1 }))).toBe(2);
  });

  it('retranche un « pas pour moi » autant qu’il ajoute un « j’aime »', () => {
    expect(preferenceScore(tally({ destinationId: 'a', likes: 3, dislikes: 3 }))).toBe(0);
  });

  it('vaut zéro là où personne ne s’est exprimé', () => {
    expect(preferenceScore(undefined)).toBe(0);
  });
});

describe('choix du groupe', () => {
  const classement = ['barcelone', 'rome', 'budapest'];

  it('désigne la destination la plus soutenue', () => {
    const votes = new Map([
      ['barcelone', tally({ destinationId: 'barcelone', likes: 1 })],
      ['rome', tally({ destinationId: 'rome', likes: 3 })],
    ]);
    expect(groupChoice(votes, classement)?.destinationId).toBe('rome');
  });

  it('peut contredire le classement calculé — c’est le but', () => {
    const votes = new Map([['budapest', tally({ destinationId: 'budapest', favorites: 2 })]]);
    const choix = groupChoice(votes, classement);
    expect(choix?.destinationId).toBe('budapest');
    expect(choix?.destinationId).not.toBe(classement[0]);
  });

  it('ignore une destination qui déplaît plus qu’elle ne plaît', () => {
    const votes = new Map([
      ['barcelone', tally({ destinationId: 'barcelone', likes: 1, dislikes: 3 })],
    ]);
    expect(groupChoice(votes, classement)).toBeNull();
  });

  it('départage une égalité par le classement calculé, pas au hasard', () => {
    const votes = new Map([
      ['rome', tally({ destinationId: 'rome', likes: 2 })],
      ['budapest', tally({ destinationId: 'budapest', likes: 2 })],
    ]);
    // Rome est devant Budapest dans le classement : elle garde l'avantage.
    expect(groupChoice(votes, classement)?.destinationId).toBe('rome');
  });

  it('ne désigne personne tant que personne n’a voté', () => {
    expect(groupChoice(new Map(), classement)).toBeNull();
  });

  it('compte les soutiens, favoris compris', () => {
    const votes = new Map([
      ['rome', tally({ destinationId: 'rome', likes: 2, favorites: 1, dislikes: 1 })],
    ]);
    expect(groupChoice(votes, classement)?.supporters).toBe(3);
  });
});
