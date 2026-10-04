import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chargerIllustrations,
  enPaquets,
  estAffichable,
  lireLEtiquette,
  lireLesCredits,
  lireLesImages,
  texteBrut,
} from './illustrations';

describe('illustrations des activités', () => {
  it('sépare la langue du titre', () => {
    expect(lireLEtiquette('fr:Mont Batur')).toEqual({ langue: 'fr', titre: 'Mont Batur' });
    expect(lireLEtiquette('en:Big Buddha, Phuket')).toEqual({
      langue: 'en',
      titre: 'Big Buddha, Phuket',
    });
  });

  it('refuse ce qui n’est pas une étiquette', () => {
    for (const invalide of [undefined, '', 'Mont Batur', 'f:X', 'francais:Mont', 'fr:']) {
      expect(lireLEtiquette(invalide), String(invalide)).toBeNull();
    }
  });

  it('lit les images d’une réponse Wikipédia', () => {
    const images = lireLesImages({
      query: {
        pages: {
          '123': {
            title: 'Mont Batur',
            thumbnail: { source: 'https://upload.wikimedia.org/x/batur.jpg' },
            pageimage: 'Batur.jpg',
          },
        },
      },
    });
    expect(images.get('Mont Batur')).toEqual({
      url: 'https://upload.wikimedia.org/x/batur.jpg',
      fichier: 'Batur.jpg',
    });
  });

  it('refuse une image servie ailleurs que par Wikimedia', () => {
    // La licence qu'on s'apprête à afficher est celle de Commons. Une image
    // venue d'un autre domaine n'a pas cette licence, et l'afficher avec ce
    // crédit serait faux.
    const images = lireLesImages({
      query: {
        pages: {
          '1': {
            title: 'X',
            thumbnail: { source: 'https://exemple.test/photo.jpg' },
            pageimage: 'photo.jpg',
          },
        },
      },
    });
    expect(images.size).toBe(0);
  });

  it('retrouve une image derrière un titre normalisé', () => {
    // Wikipédia met une majuscule et remplace les tirets bas. Sans report,
    // « mont batur » ne retrouverait pas sa propre image.
    const images = lireLesImages({
      query: {
        normalized: [{ from: 'mont batur', to: 'Mont Batur' }],
        pages: {
          '1': {
            title: 'Mont Batur',
            thumbnail: { source: 'https://upload.wikimedia.org/x/b.jpg' },
            pageimage: 'b.jpg',
          },
        },
      },
    });
    expect(images.get('mont batur')?.fichier).toBe('b.jpg');
  });

  it('retrouve une image derrière une redirection, même après normalisation', () => {
    // Le cas réel : le carnet demande « Cathédrale de Sienne », Wikipédia
    // redirige et rend la page sous son titre complet.
    const images = lireLesImages({
      query: {
        normalized: [{ from: 'cathédrale de Sienne', to: 'Cathédrale de Sienne' }],
        redirects: [
          { from: 'Cathédrale de Sienne', to: 'Cathédrale Santa Maria Assunta de Sienne' },
        ],
        pages: {
          '1': {
            title: 'Cathédrale Santa Maria Assunta de Sienne',
            thumbnail: { source: 'https://upload.wikimedia.org/x/s.jpg' },
            pageimage: 's.jpg',
          },
        },
      },
    });
    expect(images.get('Cathédrale de Sienne')?.fichier).toBe('s.jpg');
    expect(images.get('cathédrale de Sienne')?.fichier).toBe('s.jpg');
  });

  it('ne s’effondre devant aucune réponse', () => {
    for (const bancal of [null, undefined, 42, 'texte', {}, { query: {} }, { query: { pages: null } }]) {
      expect(() => lireLesImages(bancal)).not.toThrow();
      expect(lireLesImages(bancal).size).toBe(0);
      expect(() => lireLesCredits(bancal)).not.toThrow();
    }
  });

  it('nettoie le HTML que Commons met dans le nom de l’auteur', () => {
    expect(texteBrut('<a href="/wiki/User:X" title="X">Jean Dupont</a>')).toBe('Jean Dupont');
    expect(texteBrut('<span>Marie&nbsp;Curie</span>')).toBe('Marie Curie');
    expect(texteBrut(null)).toBeNull();
    expect(texteBrut('<p></p>')).toBeNull();
    // Une notice de licence entière n'est pas un nom d'auteur.
    expect(texteBrut('x'.repeat(250))).toBeNull();
  });

  it('lit les crédits sans le préfixe du fichier', () => {
    const credits = lireLesCredits({
      query: {
        pages: {
          '-1': {
            title: 'File:Batur.jpg',
            imageinfo: [
              {
                extmetadata: {
                  Artist: { value: '<a>Jane Doe</a>' },
                  LicenseShortName: { value: 'CC BY-SA 4.0' },
                },
              },
            ],
          },
        },
      },
    });
    expect(credits.get('Batur.jpg')).toEqual({ auteur: 'Jane Doe', licence: 'CC BY-SA 4.0' });
  });

  it('n’affiche pas une image dont on ignore la licence', () => {
    // Les images de Commons sont libres, presque jamais sans condition. Sans
    // savoir laquelle, on ne peut pas la respecter — donc on n'affiche pas.
    const base = { url: 'https://upload.wikimedia.org/x.jpg', page: 'https://commons…' };
    expect(estAffichable(undefined)).toBe(false);
    expect(estAffichable({ ...base, auteur: 'Jane', licence: null })).toBe(false);
    expect(estAffichable({ ...base, auteur: null, licence: 'CC BY-SA 4.0' })).toBe(true);
  });
});

/**
 * Une ville d'OpenStreetMap peut compter soixante lieux documentés dans la
 * même langue. L'API de Wikimedia ignore en silence tout ce qui dépasse
 * cinquante titres : sans découpage, les derniers restaient sans photo.
 */
describe('illustrations par paquets', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('découpe une liste en paquets de cinquante, dans l’ordre', () => {
    const liste = Array.from({ length: 120 }, (_, i) => i);
    const paquets = enPaquets(liste);
    expect(paquets.map((paquet) => paquet.length)).toEqual([50, 50, 20]);
    expect(paquets.flat()).toEqual(liste);
    expect(enPaquets([])).toEqual([]);
  });

  it('illustre et crédite soixante lieux, pas seulement les cinquante premiers', async () => {
    const lieux = Array.from({ length: 60 }, (_, i) => ({
      id: `osm:node/${i}`,
      wikipedia: `pt:Lieu ${i}`,
    }));
    const appels: string[] = [];

    vi.stubGlobal('fetch', async (entree: string) => {
      const url = new URL(entree);
      appels.push(url.hostname);
      const titres = (url.searchParams.get('titles') ?? '').split('|');
      expect(titres.length).toBeLessThanOrEqual(50);
      const pages = Object.fromEntries(
        titres.map((titre, i) =>
          url.hostname === 'commons.wikimedia.org'
            ? [
                String(i),
                {
                  title: titre,
                  imageinfo: [
                    {
                      extmetadata: {
                        Artist: { value: 'Quelqu’un' },
                        LicenseShortName: { value: 'CC BY-SA 4.0' },
                      },
                    },
                  ],
                },
              ]
            : [
                String(i),
                {
                  title: titre,
                  pageimage: `${titre}.jpg`,
                  thumbnail: { source: `https://upload.wikimedia.org/${encodeURIComponent(titre)}.jpg` },
                },
              ],
        ),
      );
      return new Response(JSON.stringify({ query: { pages } }));
    });

    const illustrations = await chargerIllustrations(lieux);

    expect(appels.filter((hote) => hote === 'pt.wikipedia.org')).toHaveLength(2);
    expect(appels.filter((hote) => hote === 'commons.wikimedia.org')).toHaveLength(2);
    expect(Object.keys(illustrations)).toHaveLength(60);
    expect(estAffichable(illustrations['osm:node/59'])).toBe(true);
  });

  it('ignore les lieux sans article, sans rien demander', async () => {
    const espion = vi.fn();
    vi.stubGlobal('fetch', espion);
    expect(await chargerIllustrations([{ id: 'a' }, { id: 'b', wikipedia: 'Sans langue' }])).toEqual(
      {},
    );
    expect(espion).not.toHaveBeenCalled();
  });
});
