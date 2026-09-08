import { describe, expect, it } from 'vitest';
import { hasAnswered, prochainGeste, tripReadiness } from './readiness.js';
import { normalizeWeights } from './preferences.js';
import type { MemberPreference, TripConstraints } from './types.js';

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    durationDays: 4,
    dateMode: 'month',
    month: 10,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 50_000,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

function membre(id: string, repondu = true, budget: number | null = 40_000): MemberPreference {
  return {
    userId: id,
    // Les deux passent par normalizeWeights, comme les vraies données.
    weights: normalizeWeights(repondu ? { culture: 1 } : {}),
    budgetMaxCents: budget,
  };
}

const COMPLET = [membre('a'), membre('b'), membre('c'), membre('d')];

function genres(readiness: ReturnType<typeof tripReadiness>): string[] {
  return readiness.blockers.map((blocage) => blocage.kind);
}

describe('a-t-on répondu ?', () => {
  it('reconnaît une envie exprimée', () => {
    expect(hasAnswered({ food: 1 })).toBe(true);
    expect(hasAnswered({ culture: 0.33 })).toBe(true);
  });

  it('ne se laisse pas berner par des préférences normalisées', () => {
    // Piège réel : `normalizeWeights` remplit les huit axes à zéro. Tester la
    // présence des clés dirait que tout le monde a répondu, y compris ceux qui
    // n'ont jamais ouvert l'écran.
    expect(hasAnswered({})).toBe(false);
    expect(hasAnswered(normalizeWeights({}))).toBe(false);
    expect(hasAnswered(normalizeWeights({ food: 1 }))).toBe(true);
  });
});

describe('ce qui bloque le groupe', () => {
  it('compte les absents sans en faire un blocage', () => {
    const etat = tripReadiness({ constraints: constraints(), members: [membre('a')] });
    const absents = etat.blockers.find((blocage) => blocage.kind === 'members')!;
    expect(absents.label).toBe('3 personnes n’ont pas encore rejoint');
    expect(absents.blocking).toBe(false);
  });

  it('accorde le singulier', () => {
    const etat = tripReadiness({
      constraints: constraints({ participants: 2 }),
      members: [membre('a')],
    });
    expect(etat.blockers.find((blocage) => blocage.kind === 'members')?.label).toContain(
      'Une personne',
    );
  });

  it('traite les envies manquantes comme un vrai blocage', () => {
    const etat = tripReadiness({
      constraints: constraints(),
      members: [membre('a'), membre('b', false), membre('c'), membre('d')],
    });
    const envies = etat.blockers.find((blocage) => blocage.kind === 'preferences')!;
    expect(envies.blocking).toBe(true);
    expect(envies.consequence).toContain('équité');
    expect(etat.readyToDecide).toBe(false);
  });

  it('ne réclame pas de budget quand le groupe cherche le moins cher', () => {
    const sansBudget = COMPLET.map((m) => ({ ...m, budgetMaxCents: null }));
    expect(
      genres(tripReadiness({ constraints: constraints(), members: sansBudget })),
    ).toContain('budget');
    expect(
      genres(
        tripReadiness({
          constraints: constraints({ budgetMode: 'cheapest' }),
          members: sansBudget,
        }),
      ),
    ).not.toContain('budget');
  });

  it('bloque quand aucune période n’est fixée', () => {
    const etat = tripReadiness({
      constraints: { ...constraints(), month: undefined, dateMode: 'window' },
      members: COMPLET,
    });
    const periode = etat.blockers.find((blocage) => blocage.kind === 'period')!;
    expect(periode.blocking).toBe(true);
    expect(periode.consequence).toContain('météo');
  });

  it('met les vrais blocages en premier', () => {
    const etat = tripReadiness({
      constraints: constraints(),
      members: [membre('a'), membre('b', false)],
    });
    // Les absents (non bloquant) ne doivent pas passer devant les envies
    // manquantes (bloquant).
    expect(etat.blockers[0]?.blocking).toBe(true);
  });

  it('distingue « personne n’a voté » de « il en manque »', () => {
    const aucun = tripReadiness({ constraints: constraints(), members: COMPLET, votes: 0 });
    expect(aucun.blockers.find((b) => b.kind === 'vote')?.blocking).toBe(true);

    const partiel = tripReadiness({ constraints: constraints(), members: COMPLET, votes: 3 });
    const vote = partiel.blockers.find((b) => b.kind === 'vote')!;
    expect(vote.blocking).toBe(false);
    expect(vote.label).toBe('Une personne n’a pas voté');
  });

  it('ne dit plus rien du vote une fois la destination arrêtée', () => {
    const etat = tripReadiness({
      constraints: constraints(),
      members: COMPLET,
      votes: 4,
      locked: true,
    });
    expect(etat.blockers).toEqual([]);
    expect(etat.readyToDecide).toBe(true);
    expect(etat.progress).toBe(100);
  });

  it('avance la barre à chaque jalon franchi', () => {
    const rien = tripReadiness({ constraints: constraints(), members: [] });
    expect(rien.progress).toBe(0);

    const reunis = tripReadiness({ constraints: constraints(), members: COMPLET });
    expect(reunis.progress).toBe(50);

    const votants = tripReadiness({ constraints: constraints(), members: COMPLET, votes: 2 });
    expect(votants.progress).toBe(75);
  });

  it('ne nomme jamais personne', () => {
    // La pression sociale n'est pas une fonctionnalité : on compte, on
    // n'accuse pas.
    const etat = tripReadiness({
      constraints: constraints(),
      members: [membre('camille'), membre('dominique', false)],
    });
    for (const blocage of etat.blockers) {
      expect(`${blocage.label} ${blocage.consequence}`).not.toContain('dominique');
    }
  });
});

describe('le prochain geste', () => {
  /** Un contexte où tout va bien : chaque test n'en change qu'une chose. */
  function contexte(surcharge: Parameters<typeof prochainGeste>[0] | object = {}) {
    return prochainGeste({
      readiness: tripReadiness({
        constraints: constraints(),
        members: COMPLET,
        votes: 4,
        locked: true,
      }),
      jAiRepondu: true,
      jAiVote: true,
      jeSuisOrganisateur: false,
      destinationArretee: true,
      itineraireVide: false,
      collaborationPossible: true,
      propositions: 6,
      ...surcharge,
    });
  }

  it('ne propose rien quand il n’y a rien à faire', () => {
    expect(contexte()).toBeNull();
  });

  it('fait passer ce que je peux faire seul avant ce que j’attends des autres', () => {
    // Ici tout manque à la fois : personne n'a rejoint, personne n'a répondu,
    // personne n'a voté. Ce qui doit ressortir, c'est ma propre réponse — la
    // seule qui ne dépende de personne.
    const geste = contexte({
      readiness: tripReadiness({ constraints: constraints(), members: [membre('moi', false)] }),
      jAiRepondu: false,
      jAiVote: false,
      destinationArretee: false,
      itineraireVide: true,
    });
    expect(geste?.cible).toBe('mes-envies');
    expect(geste?.personnel).toBe(true);
  });

  it('propose d’inviter quand il manque du monde', () => {
    const geste = contexte({
      readiness: tripReadiness({ constraints: constraints(), members: [membre('a')], votes: 1 }),
      destinationArretee: false,
    });
    expect(geste?.cible).toBe('participants');
    expect(geste?.personnel).toBe(false);
  });

  it('ne propose jamais d’inviter en mode local', () => {
    // Sans serveur, il n'y a personne à inviter : proposer un lien serait une
    // impasse, et une impasse en haut de l'écran décourage plus qu'un vide.
    const geste = contexte({
      readiness: tripReadiness({ constraints: constraints(), members: [membre('a')], votes: 1 }),
      collaborationPossible: false,
      destinationArretee: false,
    });
    expect(geste?.cible).not.toBe('participants');
  });

  it('demande mon vote avant de relancer les autres', () => {
    const geste = contexte({
      readiness: tripReadiness({ constraints: constraints(), members: COMPLET, votes: 1 }),
      jAiVote: false,
      destinationArretee: false,
    });
    expect(geste?.cible).toBe('propositions');
    expect(geste?.personnel).toBe(true);
  });

  it('propose de trancher à l’organisateur, et d’attendre aux autres', () => {
    const tousOntVote = {
      readiness: tripReadiness({ constraints: constraints(), members: COMPLET, votes: 4 }),
      destinationArretee: false,
    };
    expect(contexte({ ...tousOntVote, jeSuisOrganisateur: true })?.cible).toBe('trancher');

    const membreSimple = contexte({ ...tousOntVote, jeSuisOrganisateur: false });
    expect(membreSimple?.cible).not.toBe('trancher');
    expect(membreSimple?.personnel).toBe(false);
  });

  it('n’envoie pas voter s’il n’y a rien à voter', () => {
    // Un voyage dont la destination est déjà écrite dans les contraintes n'a
    // aucune proposition : lui demander de voter serait absurde.
    const geste = contexte({
      readiness: tripReadiness({ constraints: constraints(), members: COMPLET }),
      jAiVote: false,
      destinationArretee: false,
      propositions: 0,
    });
    expect(geste?.cible).not.toBe('propositions');
  });

  it('bascule sur l’itinéraire une fois la destination arrêtée', () => {
    const geste = contexte({ itineraireVide: true });
    expect(geste?.cible).toBe('itineraire');
  });

  it('ne nomme jamais personne, comme le reste du module', () => {
    const geste = contexte({
      readiness: tripReadiness({
        constraints: constraints(),
        members: [membre('camille'), membre('dominique', false)],
      }),
      destinationArretee: false,
    });
    expect(`${geste?.titre} ${geste?.pourquoi}`).not.toContain('dominique');
  });
});
