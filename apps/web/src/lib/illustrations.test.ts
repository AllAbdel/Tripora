import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chargerIllustrations,
  enPaquets,
  estAffichable,
  estServieParWikimedia,
  lireLEtiquette,
  lireLesCredits,
  lireLesImages,
  PALIERS_WIKIMEDIA,
  texteBrut,
  vignette,
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

  it('lit les vignettes servies depuis thumb.wikimedia.org, comme l’API les rend désormais', () => {
    // La réponse réelle de fr.wikipedia.org pour « Dune du Pilat » : l'hôte a
    // changé, la largeur est arrondie au palier de 960 px. N'accepter que
    // upload.wikimedia.org écartait toutes les photos des activités.
    const source =
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/DunePyla.JPG/960px-DunePyla.JPG' +
      '?utm_source=fr.wikipedia.org&utm_campaign=api&utm_content=thumbnail';
    const images = lireLesImages({
      query: {
        pages: {
          '4093859': {
            title: 'Dune du Pilat',
            thumbnail: { source, width: 640, height: 480 },
            pageimage: 'DunePyla.JPG',
          },
        },
      },
    });
    expect(images.get('Dune du Pilat')).toEqual({ url: source, fichier: 'DunePyla.JPG' });
  });

  it('n’accepte que Wikimedia, en HTTPS, même déguisé', () => {
    expect(estServieParWikimedia('https://upload.wikimedia.org/x.jpg')).toBe(true);
    expect(estServieParWikimedia('https://thumb.wikimedia.org/x.jpg')).toBe(true);
    for (const autre of [
      'http://upload.wikimedia.org/x.jpg',
      'https://wikimedia.org.exemple.test/x.jpg',
      'https://exemplewikimedia.org/x.jpg',
      'https://exemple.test/upload.wikimedia.org/x.jpg',
      'pas une adresse',
    ]) {
      expect(estServieParWikimedia(autre), autre).toBe(false);
    }
  });

  it('réduit une vignette vers un palier accepté, sans toucher au reste de l’adresse', () => {
    const grande =
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/DunePyla.JPG/960px-DunePyla.JPG?utm_source=fr.wikipedia.org';
    expect(vignette(grande, 250)).toBe(
      'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/DunePyla.JPG/250px-DunePyla.JPG?utm_source=fr.wikipedia.org',
    );
    // Un fichier dont le nom commence lui-même par une largeur.
    expect(
      vignette('https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/960px-Plan.png/960px-960px-Plan.png', 250),
    ).toBe('https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/960px-Plan.png/250px-960px-Plan.png');
    // L'original, ou une vignette déjà plus petite : on n'agrandit jamais.
    const original = 'https://upload.wikimedia.org/wikipedia/commons/d/d4/DunePyla.JPG';
    expect(vignette(original, 250)).toBe(original);
    const petite = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d4/X.jpg/120px-X.jpg';
    expect(vignette(petite, 250)).toBe(petite);
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
    const adresses: string[] = [];

    vi.stubGlobal('fetch', async (entree: string) => {
      const url = new URL(entree);
      appels.push(url.hostname);
      adresses.push(entree);
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

    // Une largeur que Wikimedia accepte : les autres sont refusées.
    const largeur = Number(new URL(adresses.find((adresse) => adresse.includes('pageimages'))!).searchParams.get('pithumbsize'));
    expect(PALIERS_WIKIMEDIA).toContain(largeur);
    expect(appels.filter((hote) => hote === 'pt.wikipedia.org')).toHaveLength(2);
    expect(appels.filter((hote) => hote === 'commons.wikimedia.org')).toHaveLength(2);
    expect(Object.keys(illustrations)).toHaveLength(60);
    expect(estAffichable(illustrations['osm:node/59'])).toBe(true);
  });

  it('raccroche le crédit à sa photo quand le nom du fichier contient des espaces', async () => {
    // Les vraies réponses pour le château de Prague : Wikipédia écrit le
    // fichier avec des soulignés, Commons répond avec des espaces.
    vi.stubGlobal('fetch', async (entree: string) => {
      const url = new URL(entree);
      const json =
        url.hostname === 'commons.wikimedia.org'
          ? {
              query: {
                normalized: [{ from: 'File:Chateau_de_Prague.jpg', to: 'File:Chateau de Prague.jpg' }],
                pages: {
                  '-1': {
                    title: 'File:Chateau de Prague.jpg',
                    imageinfo: [{ extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' } } }],
                  },
                },
              },
            }
          : {
              query: {
                pages: {
                  '1013597': {
                    title: 'Château de Prague',
                    pageimage: 'Chateau_de_Prague.jpg',
                    thumbnail: {
                      source:
                        'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/Chateau_de_Prague.jpg/960px-Chateau_de_Prague.jpg',
                    },
                  },
                },
              },
            };
      return new Response(JSON.stringify(json));
    });
    const illustrations = await chargerIllustrations([{ id: 'prague/chateau', wikipedia: 'fr:Château de Prague' }]);
    expect(illustrations['prague/chateau']?.licence).toBe('CC BY-SA 4.0');
    expect(estAffichable(illustrations['prague/chateau'])).toBe(true);
  });

  it('n’illustre pas une activité par un article qui décrit une chose, pas un lieu', async () => {
    const espion = vi.fn();
    vi.stubGlobal('fetch', espion);
    expect(await chargerIllustrations([{ id: 'marrakech/hammam', wikipedia: 'fr:Hammam' }])).toEqual({});
    expect(espion).not.toHaveBeenCalled();
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
