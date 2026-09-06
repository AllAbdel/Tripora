import { describe, expect, it } from 'vitest';
import { lireLieux } from './places';

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

  it('ne casse pas sur une réponse inattendue', () => {
    expect(lireLieux(null).liste).toEqual([]);
    expect(lireLieux({ places: 'aucun' }).liste).toEqual([]);
    expect(lireLieux({}).liste).toEqual([]);
    expect(lireLieux('erreur').liste).toEqual([]);
  });
});
