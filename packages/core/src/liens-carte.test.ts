import { describe, expect, it } from 'vitest';
import { estUnLienDeCarte, estUnRaccourciDeCarte, lieuDuLienDeCarte } from './links.js';

describe('un lien de carte', () => {
  it('lit le lieu exact d’une fiche Google Maps, plutôt que le centre de la vue', () => {
    const lieu = lieuDuLienDeCarte(
      'https://www.google.com/maps/place/Time+Out+Market+Lisboa/@38.7069,-9.1466,17z/data=!3m1!4b1!4m6!3m5!1s0xd19347!8m2!3d38.706964!4d-9.145807!16s%2Fg%2F11',
    );
    expect(lieu).toEqual({ nom: 'Time Out Market Lisboa', lat: 38.706964, lng: -9.145807, recherche: null });
  });

  it('se contente de la vue, ou d’un point écrit dans la requête', () => {
    expect(lieuDuLienDeCarte('https://www.google.com/maps/@41.4036,2.1744,15z')).toMatchObject({
      lat: 41.4036,
      lng: 2.1744,
      nom: null,
    });
    expect(lieuDuLienDeCarte('https://maps.google.com/?q=48.8584,2.2945')).toMatchObject({
      lat: 48.8584,
      lng: 2.2945,
    });
  });

  it('garde un nom sans point pour le chercher ensuite', () => {
    expect(
      lieuDuLienDeCarte('https://www.google.com/maps/search/?api=1&query=Pasteis+de+Belem'),
    ).toEqual({ nom: 'Pasteis de Belem', lat: null, lng: null, recherche: 'Pasteis de Belem' });
  });

  it('lit Plans d’Apple et OpenStreetMap', () => {
    expect(lieuDuLienDeCarte('https://maps.apple.com/?ll=38.6916,-9.2160&q=Tour%20de%20Belém')).toEqual({
      nom: 'Tour de Belém',
      lat: 38.6916,
      lng: -9.216,
      recherche: null,
    });
    expect(
      lieuDuLienDeCarte('https://www.openstreetmap.org/?mlat=43.2140&mlon=5.4480#map=16/43.2140/5.4480'),
    ).toMatchObject({ lat: 43.214, lng: 5.448 });
  });

  it('reconnaît les raccourcis, qu’il faut suivre, et ignore le reste', () => {
    expect(estUnRaccourciDeCarte('https://maps.app.goo.gl/AbCd123')).toBe(true);
    expect(lieuDuLienDeCarte('https://maps.app.goo.gl/AbCd123')).toBeNull();
    expect(estUnLienDeCarte('https://www.tiktok.com/@x/video/1')).toBe(false);
    expect(lieuDuLienDeCarte('https://www.google.com/search?q=lisbonne')).toBeNull();
    // Un point impossible n'est pas un point.
    expect(lieuDuLienDeCarte('https://maps.google.com/?q=123,456')).toMatchObject({ lat: null });
  });
});
