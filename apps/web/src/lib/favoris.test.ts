import { beforeEach, describe, expect, it, vi } from 'vitest';
import { favorisEnTete, listerFavoris } from './favoris';

/**
 * Sans serveur, explicitement.
 *
 * `apps/web/.env` est versionné — il ne contient que des valeurs publiques —
 * donc le client Supabase existe dès qu'on lance les tests depuis le dépôt, et
 * `listerFavoris` part interroger la vraie base. Ici elle répondait « aucun
 * favori » pour un appelant non authentifié, et le test échouait en
 * intégration continue tout en passant sur une machine dont le réseau est
 * fermé. Un test ne doit dépendre ni de l'un ni de l'autre : on coupe le
 * serveur pour de bon, et le chemin local est le seul exercé.
 *
 * La configuration de Vitest vide déjà ces variables pour tous les tests ;
 * ce remplacement-ci garantit le chemin même si quelqu'un l'y remet.
 */
vi.mock('./supabase', () => ({ supabase: null }));

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

describe('la liste des favoris traverse le cache', () => {
  beforeEach(() => localStorage.clear());

  it('survit à un aller-retour en JSON', async () => {
    // Le cache des requêtes est conservé en JSON d'une visite à l'autre. Un
    // `Set` en revenait sous la forme `{}` : l'écran des voyages appelait
    // `.has()` dessus et toute l'application s'arrêtait sur une page blanche
    // à la deuxième ouverture. Ce test échoue si quelqu'un remet un `Set`.
    localStorage.setItem('tripora.favoris', JSON.stringify(['v1', 'v2']));
    const liste = await listerFavoris();
    const apresLeCache: unknown = JSON.parse(JSON.stringify(liste));
    expect(apresLeCache).toEqual(['v1', 'v2']);
    expect(new Set(apresLeCache as string[]).has('v1')).toBe(true);
  });

  it('ne rend jamais deux fois le même voyage', async () => {
    localStorage.setItem('tripora.favoris', JSON.stringify(['v1', 'v1', 'v2']));
    expect(await listerFavoris()).toEqual(['v1', 'v2']);
  });

  it('rend une liste vide quand le stockage est illisible', async () => {
    localStorage.setItem('tripora.favoris', 'ceci n’est pas du JSON');
    expect(await listerFavoris()).toEqual([]);
  });
});
