import { describe, expect, it } from 'vitest';
import { estAffichable, lireLEtiquette, lireLesCredits, lireLesImages, texteBrut } from './illustrations';

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
