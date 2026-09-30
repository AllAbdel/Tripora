import { describe, expect, it, vi } from 'vitest';
import { ceQuiEstPartage, LectureImpossible, lireLePartage, messageDeLecture } from './partage';

vi.mock('./supabase', () => ({ supabase: null }));
vi.mock('./geocode', () => ({
  chercherAdresses: vi.fn().mockResolvedValue([
    { label: 'Pastéis de Belém', address: 'Rua de Belém 84, Lisboa', lat: 38.6975, lng: -9.2032 },
  ]),
}));

describe('ce qui est partagé', () => {
  it('trouve le lien au milieu du texte envoyé par Android', () => {
    const partage = ceQuiEstPartage(
      new URLSearchParams({ texte: 'Regarde ça 😍 https://vm.tiktok.com/ZNabc/ #lisbonne' }),
    );
    expect(partage.lien).toBe('https://vm.tiktok.com/ZNabc/');
    expect(partage.texte).toContain('#lisbonne');
  });

  it('préfère le lien rangé à part par le navigateur', () => {
    const partage = ceQuiEstPartage(
      new URLSearchParams({ titre: 'Time Out Market', lien: 'https://maps.app.goo.gl/xyz' }),
    );
    expect(partage).toEqual({ lien: 'https://maps.app.goo.gl/xyz', texte: 'Time Out Market' });
  });
});

describe('lire un lien partagé', () => {
  it('lit une fiche Google Maps sans rien demander au serveur', async () => {
    const lecture = await lireLePartage({
      lien: 'https://www.google.com/maps/place/Time+Out+Market/@38.70,-9.14,17z/data=!3d38.706964!4d-9.145807',
      texte: '',
      pres: null,
      destination: null,
    });
    expect(lecture.source).toBe('carte');
    expect(lecture.lieux).toEqual([
      { nom: 'Time Out Market', lat: 38.706964, lng: -9.145807, adresse: null },
    ]);
  });

  it('situe un lieu nommé sans coordonnées', async () => {
    const lecture = await lireLePartage({
      lien: 'https://www.google.com/maps/search/?api=1&query=Past%C3%A9is+de+Bel%C3%A9m',
      texte: '',
      pres: null,
      destination: null,
    });
    expect(lecture.lieux[0]).toMatchObject({ nom: 'Pastéis de Belém', lat: 38.6975 });
  });

  it('dit franchement quand une vidéo demande un serveur absent', async () => {
    await expect(
      lireLePartage({ lien: 'https://www.tiktok.com/@a/video/1', texte: '', pres: null, destination: null }),
    ).rejects.toBeInstanceOf(LectureImpossible);
    expect(messageDeLecture(new LectureImpossible('serveur'))).toMatch(/demande un serveur/);
  });
});
