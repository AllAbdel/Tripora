import { describe, expect, it } from 'vitest';
import { favorisEnTete } from './favoris';

describe('ordre des favoris', () => {
  const voyages = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('remonte les épinglés en tête', () => {
    const trie = favorisEnTete(voyages, new Set(['c']));
    expect(trie.map((v) => v.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('garde l’ordre d’origine entre épinglés, et entre non épinglés', () => {
    // Sans stabilité, la liste se réordonnerait toute seule à chaque épingle.
    const trie = favorisEnTete(voyages, new Set(['d', 'b']));
    expect(trie.map((v) => v.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('ne touche à rien quand rien n’est épinglé', () => {
    expect(favorisEnTete(voyages, new Set()).map((v) => v.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignore un favori qui ne correspond à aucun voyage', () => {
    const trie = favorisEnTete(voyages, new Set(['zzz']));
    expect(trie.map((v) => v.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
