import { describe, expect, it } from 'vitest';
import { adressePublique, estNatif, lireLienEntrant } from './natif';

const SITE = 'https://tripora-eight.vercel.app';

describe('les liens qu’on donne aux autres', () => {
  it('partent du site depuis l’application, jamais du téléphone', () => {
    expect(
      adressePublique('/rejoindre/K7M2P9QX', {
        natif: true,
        originePublique: SITE,
        origineCourante: 'https://localhost',
      }),
    ).toBe(`${SITE}/rejoindre/K7M2P9QX`);
  });

  it('gardent l’adresse courante sur le site', () => {
    // Une préversion de branche invite vers elle-même, pas vers la production.
    expect(
      adressePublique('voyages/1', {
        natif: false,
        originePublique: SITE,
        origineCourante: 'https://essai.vercel.app',
      }),
    ).toBe('https://essai.vercel.app/voyages/1');
  });

  it('ne sont pas natifs dans les tests', () => {
    expect(estNatif).toBe(false);
  });
});

describe('les adresses qui rouvrent l’application', () => {
  it('reconnaît le retour de Google, avec son code', () => {
    expect(lireLienEntrant('tripora://connexion?code=abc-123', SITE)).toEqual({
      type: 'connexion',
      code: 'abc-123',
    });
  });

  it('rapporte un refus, où qu’il soit rangé', () => {
    expect(
      lireLienEntrant(
        'tripora://connexion#error=access_denied&error_description=L%27utilisateur+a+refus%C3%A9',
        SITE,
      ),
    ).toEqual({
      type: 'connexion',
      erreur: 'access_denied',
      description: "L'utilisateur a refusé",
    });
  });

  it('mène une invitation à son écran, code intact', () => {
    expect(lireLienEntrant('tripora://rejoindre/K7M2P9QX', SITE)).toEqual({
      type: 'page',
      chemin: '/rejoindre/K7M2P9QX',
    });
    expect(lireLienEntrant(`${SITE}/rejoindre/K7M2P9QX?source=qr`, SITE)).toEqual({
      type: 'page',
      chemin: '/rejoindre/K7M2P9QX?source=qr',
    });
  });

  it('ignore ce qui ne vient ni de Tripora ni de son site', () => {
    expect(lireLienEntrant('https://ailleurs.example/rejoindre/K7M2P9QX', SITE)).toBeNull();
    expect(lireLienEntrant('pas une adresse', SITE)).toBeNull();
    expect(lireLienEntrant(`${SITE}/voyages`, '')).toBeNull();
  });
});
