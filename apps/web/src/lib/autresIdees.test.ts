import { describe, expect, it } from 'vitest';
import { aMettreDeCote, ecarteesApres } from './autresIdees';
import type { VoteTally } from './votes';

function vote(destinationId: string, valeurs: Partial<VoteTally> = {}): VoteTally {
  return { destinationId, likes: 0, dislikes: 0, favorites: 0, mine: null, ...valeurs };
}

describe('« D’autres idées »', () => {
  it('met de côté ce que personne n’a aimé, garde ce que quelqu’un aime', () => {
    const tallies = {
      rome: vote('rome', { likes: 1 }),
      porto: vote('porto', { dislikes: 2 }),
      seville: vote('seville', { favorites: 1, dislikes: 1 }),
    };
    expect(aMettreDeCote(['rome', 'porto', 'seville', 'naples'], tallies)).toEqual([
      'porto',
      'naples',
    ]);
  });

  it('sans aucun vote, tout part', () => {
    expect(aMettreDeCote(['rome', 'porto'], undefined)).toEqual(['rome', 'porto']);
  });

  it('cumule les tours, sans doublon : on ne revoit pas ce qu’on a déjà écarté', () => {
    expect(ecarteesApres(['rome'], ['porto', 'rome'])).toEqual(['rome', 'porto']);
    expect(ecarteesApres(undefined, ['porto'])).toEqual(['porto']);
  });
});
