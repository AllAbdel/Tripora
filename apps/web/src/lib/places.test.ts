import { describe, expect, it } from 'vitest';
import { articleDuLieu, lireLieux, requeteDesLieux, type Lieux } from './places';

function reponse(places: unknown[], reste: Record<string, unknown> = {}) {
  return { places, ...reste };
}

const MUSEE = {
  id: 'osm:way/1',
  name: 'Musée national',
  lat: 38.7,
  lng: -9.1,
  tags: { tourism: 'museum', name: 'Musée national' },
};

/**
 * Ce module est une frontière : tout ce qui arrive vient d'OpenStreetMap,
 * c'est-à-dire de n'importe qui. Les tests décrivent surtout ce qui doit être
 * refusé.
 */
describe('lecture des lieux renvoyés par le serveur', () => {
  it('classe un lieu reconnu et garde ses informations', () => {
    const { liste } = lireLieux(
      reponse([{ ...MUSEE, extract: 'Un musée.', imageUrl: 'https://x/y.jpg' }]),
    );
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({
      id: 'osm:way/1',
      name: 'Musée national',
      category: 'musee',
      axis: 'culture',
      label: 'Musée',
      extract: 'Un musée.',
      imageUrl: 'https://x/y.jpg',
    });
  });

  it('écarte un lieu qu’aucune règle ne reconnaît', () => {
    expect(lireLieux(reponse([{ ...MUSEE, tags: { amenity: 'parking' } }])).liste).toEqual([]);
  });

  it('écarte une entrée incomplète sans perdre les autres', () => {
    const { liste } = lireLieux(
      reponse([
        { ...MUSEE, id: 42 },
        { ...MUSEE, lat: 'ici' },
        { ...MUSEE, name: '   ' },
        { ...MUSEE, tags: null },
        MUSEE,
      ]),
    );
    expect(liste.map((lieu) => lieu.id)).toEqual(['osm:way/1']);
  });

  it('refuse une image ou un lien qui ne sont pas en https', () => {
    const { liste } = lireLieux(
      reponse([
        {
          ...MUSEE,
          imageUrl: 'javascript:alert(1)',
          externalUrl: 'http://exemple.test',
        },
      ]),
    );
    expect(liste[0]?.imageUrl).toBeUndefined();
    expect(liste[0]?.externalUrl).toBeUndefined();
  });

  it('signale un quota épuisé sans faire échouer la lecture', () => {
    expect(lireLieux(reponse([], { quotaExceeded: true }))).toEqual({
      liste: [],
      quotaExceeded: true,
    });
  });

  it('transmet l’attente d’OpenStreetMap, et seulement un vrai booléen', () => {
    // La base répond « en attente » au premier appel pour une ville : c'est
    // ce drapeau qui fait rappeler l'écran quelques secondes plus tard.
    expect(lireLieux(reponse([], { enAttente: true }))).toEqual({
      liste: [],
      quotaExceeded: false,
      enAttente: true,
    });
    expect(lireLieux(reponse([], { enAttente: 'oui' }))).not.toHaveProperty('enAttente');
    expect(lireLieux(reponse([MUSEE], { origine: 'cache' }))).not.toHaveProperty('enAttente');
  });

  it('ne casse pas sur une réponse inattendue', () => {
    expect(lireLieux(null).liste).toEqual([]);
    expect(lireLieux({ places: 'aucun' }).liste).toEqual([]);
    expect(lireLieux({}).liste).toEqual([]);
    expect(lireLieux('erreur').liste).toEqual([]);
  });
});

/**
 * Le rappel : sans lui, la première personne à ouvrir une ville ne verrait
 * jamais les lieux d'OpenStreetMap, qui arrivent quelques secondes après.
 */
describe('rappel tant qu’OpenStreetMap est en attente', () => {
  const requete = requeteDesLieux({ id: 'bali' } as Parameters<typeof requeteDesLieux>[0]);
  const etat = (data: Lieux | undefined, dataUpdateCount = 1) =>
    ({ state: { data, dataUpdateCount } }) as never;
  const attente: Lieux = { liste: [], quotaExceeded: false, enAttente: true };
  const arrivee: Lieux = { liste: [], quotaExceeded: false };

  it('rappelle toutes les quatre secondes, puis s’arrête à l’arrivée', () => {
    const intervalle = requete.refetchInterval as (query: never) => number | false;
    expect(intervalle(etat(attente))).toBe(4_000);
    expect(intervalle(etat(arrivee))).toBe(false);
  });

  it('abandonne au bout de deux minutes plutôt que de sonder dans le vide', () => {
    const intervalle = requete.refetchInterval as (query: never) => number | false;
    expect(intervalle(etat(attente, 30))).toBe(false);
  });

  it('ne tient jamais une attente pour fraîche', () => {
    const fraicheur = requete.staleTime as (query: never) => number;
    expect(fraicheur(etat(attente))).toBe(0);
    expect(fraicheur(etat(arrivee))).toBe(24 * 60 * 60 * 1000);
  });
});

/**
 * Deux formats d'article coexistent : le titre français nu de l'ancienne
 * fonction serveur, et l'étiquette « langue:Titre » d'OpenStreetMap. Les
 * photos ne savent lire que le second.
 */
describe('article Wikipédia d’un lieu', () => {
  it('garde l’étiquette d’OpenStreetMap telle quelle', () => {
    expect(articleDuLieu(undefined, { wikipedia: 'pt:Torre de Belém' })).toBe('pt:Torre de Belém');
  });

  it('préfixe en français le titre nu de l’ancienne fonction', () => {
    expect(articleDuLieu('Tour de Belém', { wikipedia: 'pt:Torre de Belém' })).toBe(
      'fr:Tour de Belém',
    );
  });

  it('ignore une étiquette illisible', () => {
    expect(articleDuLieu(undefined, { wikipedia: 'Torre de Belém' })).toBeUndefined();
    expect(articleDuLieu(undefined, { wikipedia: 42 })).toBeUndefined();
    expect(articleDuLieu(' ', {})).toBeUndefined();
  });

  it('passe jusqu’au lieu lu', () => {
    const { liste } = lireLieux(
      reponse([{ ...MUSEE, tags: { ...MUSEE.tags, wikipedia: 'pt:Museu Nacional' } }]),
    );
    expect(liste[0]?.wikipedia).toBe('pt:Museu Nacional');
  });
});
