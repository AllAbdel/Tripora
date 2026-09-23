import { beforeEach, describe, expect, it } from 'vitest';
import { avisPourLeRemplissage, basculer, depouiller, getEnvies, nommer } from './envies';

describe('dépouillement des envies', () => {
  it('compte qui a envie, qui s’en passe, et ce que j’ai dit', () => {
    const envies = depouiller(
      [
        { subject_id: 'bali/batur', user_id: 'ines', value: 'like' },
        { subject_id: 'bali/batur', user_id: 'karim', value: 'like' },
        { subject_id: 'bali/batur', user_id: 'moi', value: 'dislike' },
        { subject_id: 'bali/tanah-lot', user_id: 'karim', value: 'favorite' },
      ],
      'moi',
    );
    expect(envies.parActivite['bali/batur']).toEqual({
      pour: ['ines', 'karim'],
      contre: ['moi'],
      moi: 'sans-moi',
    });
    // Un favori laissé par une version future compte comme une envie.
    expect(envies.parActivite['bali/tanah-lot']?.pour).toEqual(['karim']);
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
    expect(avisPourLeRemplissage(envies)).toEqual({
      'activite:bali/batur': { pour: 1, contre: 1 },
    });
    expect(avisPourLeRemplissage(undefined)).toEqual({});
  });
});

describe('les prénoms plutôt qu’un chiffre', () => {
  const noms = new Map([
    ['ines', 'Inès'],
    ['karim', 'Karim'],
    ['lea', 'Léa'],
    ['tom', 'Tom'],
  ]);

  it('nomme une ou deux personnes, et met « vous » devant', () => {
    expect(nommer(['ines'], noms, 'moi')).toBe('Inès');
    expect(nommer(['ines', 'moi'], noms, 'moi')).toBe('vous et Inès');
  });

  it('résume au-delà de deux', () => {
    expect(nommer(['ines', 'karim', 'lea'], noms, 'moi')).toBe('Inès, Karim et 1 autre');
    expect(nommer(['ines', 'karim', 'lea', 'tom'], noms, 'moi')).toBe('Inès, Karim et 2 autres');
  });

  it('ne met pas de nom sur quelqu’un qu’il ne connaît pas', () => {
    expect(nommer(['inconnu'], noms, 'moi')).toBe('quelqu’un');
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
    expect(lues.parActivite['bali/batur']).toEqual({
      pour: ['voyageur-local'],
      contre: [],
      moi: 'envie',
    });
    expect(lues.parActivite['bali/uluwatu']?.moi).toBe('sans-moi');
    expect(lues.votants).toBe(1);

    await envies.poser('v1', 'bali/batur', null);
    expect((await envies.lister('v1', 'moi')).parActivite['bali/batur']).toBeUndefined();
    // Un voyage n'emporte pas les avis d'un autre.
    expect((await envies.lister('v2', 'moi')).parActivite['bali/batur']?.moi).toBe('sans-moi');
  });
});

describe('la mise à jour optimiste', () => {
  const depart = depouiller(
    [
      { subject_id: 'bali/batur', user_id: 'ines', value: 'like' },
      { subject_id: 'bali/batur', user_id: 'moi', value: 'dislike' },
    ],
    'moi',
  );

  it('remplace mon avis sans toucher à celui des autres', () => {
    const apres = basculer(depart, 'bali/batur', 'moi', 'envie');
    expect(apres.parActivite['bali/batur']).toEqual({
      pour: ['ines', 'moi'],
      contre: [],
      moi: 'envie',
    });
    expect(apres.votants).toBe(2);
  });

  it('retire mon avis, sans jamais le compter deux fois', () => {
    const deuxFois = basculer(basculer(depart, 'bali/batur', 'moi', 'envie'), 'bali/batur', 'moi', 'envie');
    expect(deuxFois.parActivite['bali/batur']?.pour).toEqual(['ines', 'moi']);
    const retire = basculer(deuxFois, 'bali/batur', 'moi', null);
    expect(retire.parActivite['bali/batur']).toEqual({ pour: ['ines'], contre: [], moi: null });
    expect(retire.votants).toBe(1);
  });

  it('part d’un cache vide', () => {
    expect(basculer(undefined, 'bali/batur', 'moi', 'sans-moi').parActivite['bali/batur']).toEqual({
      pour: [],
      contre: ['moi'],
      moi: 'sans-moi',
    });
  });
});
