import { describe, expect, it } from 'vitest';
import {
  direLeRefus,
  lireLErreur,
  placesRestantes,
  REGLAGES_PAR_DEFAUT,
  type TripOuvert,
} from './tripsOuverts';

const TRIP: TripOuvert = {
  tripId: 't1',
  titre: 'Bali entre filles',
  couverture: null,
  resume: 'Dix jours, rythme tranquille.',
  mixite: 'mixte',
  rythme: 'equilibre',
  langues: ['fr'],
  hebergementPartage: false,
  placesMax: 6,
  placesFemmes: null,
  placesHommes: null,
  ageMin: null,
  ageMax: null,
  validation: 'organisateur',
  presentationMinimum: 80,
  destinationId: 'bali',
  origineNom: 'Paris-Orly',
  origineIata: ['ORY', 'PAR'],
  publieLe: '2026-09-22T08:00:00Z',
  dureeJours: 10,
  debut: null,
  fin: null,
  moisCible: 10,
  budgetParPersonneCents: 120_000,
  devise: 'EUR',
  membres: 2,
  membresFemmes: 2,
  membresHommes: 0,
};

describe('trips ouverts', () => {
  it('compte les places qui restent', () => {
    expect(placesRestantes(TRIP).total).toBe(4);
  });

  it('dit combien de places restent réservées à chaque genre', () => {
    // Le cas qui fait tout l'intérêt du quota : quatre places libres, mais
    // seulement une pour les hommes. Annoncer « 4 places » sans le préciser
    // ferait postuler trois personnes pour rien.
    const quotas = placesRestantes({
      ...TRIP,
      placesMax: 6,
      placesFemmes: 3,
      placesHommes: 3,
      membres: 4,
      membresFemmes: 2,
      membresHommes: 2,
    });
    expect(quotas.total).toBe(2);
    expect(quotas.pourLesFemmes).toBe(1);
    expect(quotas.pourLesHommes).toBe(1);
  });

  it('ne descend jamais en dessous de zéro', () => {
    const complet = placesRestantes({ ...TRIP, membres: 9, placesMax: 6 });
    expect(complet.total).toBe(0);
  });

  it('ne parle de quota que lorsqu’il y en a un', () => {
    expect(placesRestantes(TRIP).pourLesFemmes).toBeNull();
    expect(placesRestantes(TRIP).pourLesHommes).toBeNull();
  });

  it('traduit chaque motif de refus en une phrase', () => {
    for (const code of [
      'ferme',
      'exclu',
      'deja-membre',
      'compte-anonyme',
      'complet',
      'reserve-aux-femmes',
      'reserve-aux-hommes',
      'quota-hommes-atteint',
      'quota-femmes-atteint',
      'age-inconnu',
      'trop-jeune',
      'trop-age',
      'deja-candidat',
      'deja-refuse',
      'indisponible',
      'suspendu',
      'trop-en-attente',
      'trop-aujourdhui',
      'sans-lien',
      'trop-de-signalements',
      'deja-signale',
    ]) {
      const phrase = direLeRefus(code);
      expect(phrase, code).toBeTruthy();
      // Une phrase, pas un code : l'écran ne doit jamais afficher un
      // identifiant technique à quelqu'un qui vient de se faire refuser.
      expect(phrase, code).not.toBe(code);
      expect(phrase, code).not.toMatch(/[a-z]+-[a-z]+-[a-z]+/u);
      expect(phrase!.length, code).toBeGreaterThan(15);
      // Et une phrase se termine : un fragment laisse croire à une troncature.
      expect(phrase!.trimEnd().endsWith('.'), code).toBe(true);
    }
  });

  it('ne dit rien quand il n’y a rien à refuser', () => {
    expect(direLeRefus(null)).toBeNull();
    expect(direLeRefus(undefined)).toBeNull();
  });

  it('reste compréhensible devant un motif qu’il ne connaît pas', () => {
    expect(direLeRefus('code-invente-plus-tard')).toBe('Vous ne pouvez pas rejoindre ce voyage.');
  });

  it('sort la phrase d’une erreur Postgres', () => {
    // Les fonctions lèvent « refus:code » ; personne ne doit lire ça.
    const message = lireLErreur(new Error('refus:reserve-aux-femmes'));
    expect(message).toContain('réservé aux femmes');
    expect(message).not.toContain('refus:');
  });

  it('laisse passer une phrase déjà écrite en français', () => {
    const message = lireLErreur(
      new Error('Arrêtez d’abord la destination : sans elle, personne ne peut vous trouver'),
    );
    expect(message).toContain('personne ne peut vous trouver');
  });

  it('ne dit jamais « bloqué » à la personne bloquée', () => {
    // Le lui dire, c'est lui donner une raison de chercher un autre chemin.
    const phrase = direLeRefus('indisponible')!;
    expect(phrase.toLowerCase()).not.toContain('bloqu');
    expect(phrase.toLowerCase()).not.toContain('signal');
  });

  it('valide manuellement par défaut', () => {
    // Ouvrir sa porte ne veut pas dire la laisser ouverte : si ce défaut
    // change un jour, que ce soit une décision, pas un accident.
    expect(REGLAGES_PAR_DEFAUT.validation).toBe('organisateur');
    expect(REGLAGES_PAR_DEFAUT.mixite).toBe('mixte');
    expect(REGLAGES_PAR_DEFAUT.presentationMinimum).toBeGreaterThan(0);
  });
});
