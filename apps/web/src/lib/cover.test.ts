import { describe, expect, it } from 'vitest';
import { lireCouverture } from './cover';

const VALIDE = {
  couverture: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/b/Lisboa.jpg/1200px-Lisboa.jpg',
    auteur: 'Lacobrigo',
    licence: 'CC BY-SA 4.0',
    pageDuFichier: 'https://commons.wikimedia.org/wiki/File:Lisboa.jpg',
    article: 'Lisbonne',
  },
};

describe('lecture d’une couverture', () => {
  it('accepte une réponse complète', () => {
    const couverture = lireCouverture(VALIDE);
    expect(couverture?.auteur).toBe('Lacobrigo');
    expect(couverture?.licence).toBe('CC BY-SA 4.0');
  });

  it('refuse une image servie par n’importe qui', () => {
    // Une adresse arbitraire posée dans un <img> ferait de chaque ouverture de
    // voyage une requête vers un serveur tiers, qui apprendrait au passage
    // l'adresse IP de tous les membres du groupe.
    for (const url of [
      'https://exemple.test/photo.jpg',
      'http://upload.wikimedia.org/photo.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,iVBORw0KGgo=',
      'https://wikimedia.org.piege.ru/photo.jpg',
    ]) {
      expect(lireCouverture({ couverture: { ...VALIDE.couverture, url } })).toBeNull();
    }
  });

  it('survit à une réponse absente, vide ou mal formée', () => {
    for (const entree of [null, undefined, {}, { couverture: null }, { couverture: 'oui' }, 42]) {
      expect(lireCouverture(entree)).toBeNull();
    }
  });

  it('accepte une photo sans crédit connu plutôt que de la rejeter', () => {
    // Quelques fichiers de Commons n'ont pas d'auteur déclaré. La photo reste
    // affichable ; c'est le lien vers sa page qui porte alors la mention.
    const couverture = lireCouverture({
      couverture: { ...VALIDE.couverture, auteur: null, licence: '' },
    });
    expect(couverture?.url).toContain('wikimedia.org');
    expect(couverture?.auteur).toBeNull();
    expect(couverture?.licence).toBeNull();
  });

  it('retombe sur Commons quand la page du fichier est inutilisable', () => {
    const couverture = lireCouverture({
      couverture: { ...VALIDE.couverture, pageDuFichier: 'ftp://ailleurs' },
    });
    expect(couverture?.pageDuFichier).toBe('https://commons.wikimedia.org');
  });
});
