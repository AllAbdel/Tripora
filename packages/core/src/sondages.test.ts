import { describe, expect, it } from 'vitest';
import {
  depouiller,
  libelleDeLOption,
  problemeDuSondage,
  sondagesEnAttente,
  type Sondage,
} from './sondages.js';

function sondage(modif: Partial<Sondage> = {}): Sondage {
  return {
    id: 's1',
    tripId: 'v1',
    question: 'Quel logement ?',
    genre: 'liens',
    choixMultiple: false,
    clos: false,
    creeLe: '2026-09-24T10:00:00Z',
    options: [
      { id: 'a', libelle: 'Villa', position: 0 },
      { id: 'b', libelle: 'Riad', position: 1 },
      { id: 'c', libelle: 'Auberge', position: 2 },
    ],
    votes: [],
    ...modif,
  };
}

describe('le dépouillement', () => {
  it('compte les voix et les parts par votant', () => {
    const d = depouiller(
      sondage({
        choixMultiple: true,
        votes: [
          { optionId: 'a', userId: 'lea' },
          { optionId: 'b', userId: 'lea' },
          { optionId: 'b', userId: 'tom' },
        ],
      }),
      'tom',
    );
    expect(d.votants).toBe(2);
    expect(d.aVote).toBe(true);
    expect(d.options.map((o) => [o.option.id, o.voix, o.part, o.enTete, o.moi])).toEqual([
      ['a', 1, 0.5, false, false],
      ['b', 2, 1, true, true],
      ['c', 0, 0, false, false],
    ]);
  });

  it('personne en tête tant que personne n’a voté, les ex aequo ensemble ensuite', () => {
    expect(depouiller(sondage()).options.some((o) => o.enTete)).toBe(false);
    const d = depouiller(sondage({ votes: [{ optionId: 'a', userId: 'x' }, { optionId: 'c', userId: 'y' }] }));
    expect(d.options.filter((o) => o.enTete).map((o) => o.option.id)).toEqual(['a', 'c']);
  });

  it('garde l’ordre des options, pas celui des voix', () => {
    const d = depouiller(sondage({ votes: [{ optionId: 'c', userId: 'x' }] }));
    expect(d.options.map((o) => o.option.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('le vote secret', () => {
  it('ne montre que mes choix et le nombre de votants tant qu’il est ouvert', () => {
    const d = depouiller(
      sondage({
        secret: true,
        votes: [{ optionId: 'b', userId: 'moi' }],
        decompte: { votants: 3, voix: null },
      }),
      'moi',
    );
    expect(d.resultatsCaches).toBe(true);
    expect(d.votants).toBe(3);
    expect(d.aVote).toBe(true);
    expect(d.options.map((o) => o.voix)).toEqual([null, null, null]);
    expect(d.options.map((o) => o.moi)).toEqual([false, true, false]);
    expect(d.options.every((o) => o.votants.length === 0 && !o.enTete && o.part === 0)).toBe(true);
  });

  it('donne les voix à la clôture, jamais les noms', () => {
    const d = depouiller(
      sondage({
        secret: true,
        clos: true,
        votes: [{ optionId: 'a', userId: 'moi' }],
        decompte: { votants: 3, voix: { a: 2, b: 1 } },
      }),
      'moi',
    );
    expect(d.resultatsCaches).toBe(false);
    expect(d.options.map((o) => o.voix)).toEqual([2, 1, 0]);
    expect(d.options.map((o) => o.enTete)).toEqual([true, false, false]);
    expect(d.options[0]!.part).toBeCloseTo(2 / 3);
    expect(d.options.every((o) => o.votants.length === 0)).toBe(true);
  });

  it('compte les votes de ce navigateur sans serveur', () => {
    const ouvert = sondage({ secret: true, votes: [{ optionId: 'c', userId: 'moi' }] });
    expect(depouiller(ouvert, 'moi').votants).toBe(1);
    expect(depouiller(ouvert, 'moi').resultatsCaches).toBe(true);
    expect(depouiller({ ...ouvert, clos: true }, 'moi').options.map((o) => o.voix)).toEqual([0, 0, 1]);
  });

  it('reste à voter tant que je n’ai rien choisi', () => {
    expect(sondagesEnAttente([sondage({ secret: true, decompte: { votants: 2, voix: null } })], 'moi')).toBe(1);
  });
});

describe('ce qui attend mon vote', () => {
  it('les sondages ouverts où je n’ai rien dit', () => {
    const liste = [
      sondage({ id: '1' }),
      sondage({ id: '2', votes: [{ optionId: 'a', userId: 'moi' }] }),
      sondage({ id: '3', clos: true }),
    ];
    expect(sondagesEnAttente(liste, 'moi')).toBe(1);
    expect(sondagesEnAttente(liste, null)).toBe(0);
  });
});

describe('créer un sondage', () => {
  it('nomme un lien collé seul d’après son site', () => {
    expect(libelleDeLOption({ libelle: '', lien: 'https://www.airbnb.fr/rooms/123' })).toBe('Sur Airbnb');
    expect(libelleDeLOption({ libelle: '', lien: 'https://www.gites-de-france.com/x' })).toBe('gites-de-france.com');
    expect(libelleDeLOption({ libelle: ' Le riad ', lien: 'https://www.airbnb.fr/rooms/1' })).toBe('Le riad');
  });

  it('nomme des dates d’après la période', () => {
    expect(libelleDeLOption({ libelle: '', du: '2026-10-09', au: '2026-10-11' })).toBe('Du 9 au 11 octobre');
  });

  it('refuse ce que la base refuserait, avec une phrase', () => {
    expect(problemeDuSondage('', 'texte', [])).toBe('Posez la question.');
    expect(problemeDuSondage('Où ?', 'texte', [{ libelle: 'Ici' }])).toBe('Il faut au moins deux options.');
    expect(
      problemeDuSondage('Quand ?', 'dates', [
        { libelle: '', du: '2026-10-09', au: '2026-10-11' },
        { libelle: '', du: '2026-10-20', au: '2026-10-18' },
      ]),
    ).toBe('Les dates d’une option sont à l’envers.');
    expect(
      problemeDuSondage('Où ?', 'liens', [
        { libelle: '', lien: 'https://www.airbnb.fr/rooms/1' },
        { libelle: 'Piège', lien: 'javascript:alert(1)' },
      ]),
    ).toBe('Un lien doit commencer par https://');
    expect(
      problemeDuSondage('Où ?', 'liens', [
        { libelle: '', lien: 'https://www.airbnb.fr/rooms/1' },
        { libelle: '', lien: 'https://www.booking.com/hotel/x' },
        { libelle: '' },
      ]),
    ).toBeNull();
  });
});
