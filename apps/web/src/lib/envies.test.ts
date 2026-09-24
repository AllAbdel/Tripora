import { beforeEach, describe, expect, it } from 'vitest';
import { avisPourLeRemplissage, basculer, depouiller, getEnvies, lireLesComptes } from './envies';

describe('dépouillement des envies (mode local)', () => {
  it('compte les envies, les refus, et ce que j’ai dit — sans garder qui', () => {
    const envies = depouiller(
      [
        { subject_id: 'bali/batur', user_id: 'ines', value: 'like' },
        { subject_id: 'bali/batur', user_id: 'karim', value: 'like' },
        { subject_id: 'bali/batur', user_id: 'moi', value: 'dislike' },
        { subject_id: 'bali/tanah-lot', user_id: 'karim', value: 'favorite' },
      ],
      'moi',
    );
    expect(envies.parActivite['bali/batur']).toEqual({ pour: 2, contre: 1, moi: 'sans-moi' });
    // Un favori laissé par une version future compte comme une envie.
    expect(envies.parActivite['bali/tanah-lot']?.pour).toBe(1);
    expect(envies.votants).toBe(3);
  });

  it('ignore ce qu’il ne sait pas lire, sans rien inventer', () => {
    const envies = depouiller(
      [
        { subject_id: 42, user_id: 'ines', value: 'like' },
        { subject_id: 'bali/batur', user_id: null, value: 'like' },
        { subject_id: 'bali/batur', user_id: 'ines', value: 'peut-être' },
      ],
      'moi',
    );
    expect(envies).toEqual({ parActivite: {}, votants: 0 });
  });

  it('parle au moteur par identifiant de lieu', () => {
    const envies = depouiller(
      [
        { subject_id: 'bali/batur', user_id: 'ines', value: 'like' },
        { subject_id: 'bali/batur', user_id: 'karim', value: 'dislike' },
      ],
      'moi',
    );
    expect(avisPourLeRemplissage(envies)).toEqual({ 'activite:bali/batur': { pour: 1, contre: 1 } });
    expect(avisPourLeRemplissage(undefined)).toEqual({});
  });
});

describe('les comptes du serveur', () => {
  it('se lisent tels quels : combien, et mon avis', () => {
    const envies = lireLesComptes([
      { subject_id: 'bali/batur', pour: 3, contre: 1, moi: 'like', votants: 4 },
      { subject_id: 'bali/kecak', pour: 0, contre: 2, moi: null, votants: 4 },
    ]);
    expect(envies).toEqual({
      parActivite: {
        'bali/batur': { pour: 3, contre: 1, moi: 'envie' },
        'bali/kecak': { pour: 0, contre: 2, moi: null },
      },
      votants: 4,
    });
  });

  it('écarte ce qui ne ressemble pas à un compte', () => {
    expect(
      lireLesComptes([
        { subject_id: null, pour: 3 },
        { subject_id: 'bali/batur', pour: 'beaucoup', contre: -2, moi: 'peut-être' },
      ]),
    ).toEqual({ parActivite: {}, votants: 0 });
  });
});

describe('les envies sans serveur', () => {
  beforeEach(() => localStorage.clear());

  it('se posent, se relisent et se retirent', async () => {
    // Les tests tournent sans serveur : c'est la version locale qui répond.
    const envies = getEnvies();
    await envies.poser('v1', 'bali/batur', 'envie');
    await envies.poser('v1', 'bali/uluwatu', 'sans-moi');
    await envies.poser('v2', 'bali/batur', 'sans-moi');

    const lues = await envies.lister('v1', 'voyageur-local');
    expect(lues.parActivite['bali/batur']).toEqual({ pour: 1, contre: 0, moi: 'envie' });
    expect(lues.parActivite['bali/uluwatu']?.moi).toBe('sans-moi');
    expect(lues.votants).toBe(1);

    await envies.poser('v1', 'bali/batur', null);
    expect((await envies.lister('v1', 'moi')).parActivite['bali/batur']).toBeUndefined();
    // Un voyage n'emporte pas les avis d'un autre.
    expect((await envies.lister('v2', 'moi')).parActivite['bali/batur']?.moi).toBe('sans-moi');
  });
});

describe('la mise à jour optimiste', () => {
  // Inès a envie du Batur ; moi, non.
  const depart = lireLesComptes([{ subject_id: 'bali/batur', pour: 1, contre: 1, moi: 'dislike', votants: 2 }]);

  it('remplace mon avis sans toucher à celui des autres', () => {
    const apres = basculer(depart, 'bali/batur', 'envie');
    expect(apres.parActivite['bali/batur']).toEqual({ pour: 2, contre: 0, moi: 'envie' });
    expect(apres.votants).toBe(2);
  });

  it('retire mon avis, sans jamais le compter deux fois', () => {
    const deuxFois = basculer(basculer(depart, 'bali/batur', 'envie'), 'bali/batur', 'envie');
    expect(deuxFois.parActivite['bali/batur']?.pour).toBe(2);
    const retire = basculer(deuxFois, 'bali/batur', null);
    expect(retire.parActivite['bali/batur']).toEqual({ pour: 1, contre: 0, moi: null });
    expect(retire.votants).toBe(1);
  });

  it('part d’un cache vide', () => {
    const apres = basculer(undefined, 'bali/batur', 'sans-moi');
    expect(apres.parActivite['bali/batur']).toEqual({ pour: 0, contre: 1, moi: 'sans-moi' });
    expect(apres.votants).toBe(1);
  });

  it('efface l’activité quand plus personne n’en dit rien', () => {
    const seul = basculer(undefined, 'bali/batur', 'envie');
    expect(basculer(seul, 'bali/batur', null)).toEqual({ parActivite: {}, votants: 0 });
  });
});
