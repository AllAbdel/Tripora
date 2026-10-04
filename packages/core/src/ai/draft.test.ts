import { describe, expect, it } from 'vitest';
import { draftIsEmpty, sanitizeDraft } from './draft.js';

/**
 * Ces tests décrivent une frontière de confiance : tout ce qui arrive ici a été
 * écrit par un modèle de langage, donc par personne. On vérifie surtout ce qui
 * doit être **refusé**.
 */
describe('brouillon issu d’une phrase', () => {
  it('retient ce qui est plausible', () => {
    expect(
      sanitizeDraft({
        participants: 5,
        durationDays: 7,
        month: 10,
        budgetPerPersonCents: 40_000,
        comfortLevel: 'budget',
        groupType: 'friends',
        destination: 'Lisbonne',
        origin: 'Lyon',
        weights: { food: 0.8, nightlife: 1 },
      }),
    ).toEqual({
      participants: 5,
      durationDays: 7,
      month: 10,
      budgetPerPersonCents: 40_000,
      comfortLevel: 'budget',
      groupType: 'friends',
      destination: 'Lisbonne',
      origin: 'Lyon',
      weights: { food: 0.8, nightlife: 1 },
    });
  });

  it('écarte les nombres absurdes sans écarter le reste', () => {
    expect(sanitizeDraft({ participants: 4000, durationDays: 5 })).toEqual({ durationDays: 5 });
    expect(sanitizeDraft({ month: 0 })).toEqual({});
    expect(sanitizeDraft({ month: 13 })).toEqual({});
    expect(sanitizeDraft({ durationDays: -3 })).toEqual({});
    expect(sanitizeDraft({ budgetPerPersonCents: 99 })).toEqual({});
  });

  it('accepte un nombre écrit en texte, comme les modèles en produisent', () => {
    expect(sanitizeDraft({ participants: '5', durationDays: '7' })).toEqual({
      participants: 5,
      durationDays: 7,
    });
  });

  it('refuse les valeurs qui ne sont pas des nombres', () => {
    expect(sanitizeDraft({ participants: 'cinq', durationDays: null, month: NaN })).toEqual({});
    expect(sanitizeDraft({ participants: Infinity })).toEqual({});
  });

  it('n’accepte que les niveaux et types de groupe du domaine', () => {
    expect(sanitizeDraft({ comfortLevel: 'luxe' })).toEqual({});
    expect(sanitizeDraft({ groupType: 'collègues' })).toEqual({});
    // « standard » est le mot naturel, « mid » celui du domaine : seul le
    // second doit passer, sinon l'app stocke un niveau qu'elle ne sait pas lire.
    expect(sanitizeDraft({ comfortLevel: 'standard' })).toEqual({});
    expect(sanitizeDraft({ comfortLevel: 'mid' })).toEqual({ comfortLevel: 'mid' });
    expect(sanitizeDraft({ groupType: 'friends' })).toEqual({ groupType: 'friends' });
  });

  it('borne les poids et ignore les axes inventés', () => {
    expect(sanitizeDraft({ weights: { food: 1, culture: 0, karaoké: 1 } })).toEqual({
      weights: { food: 1, culture: 0 },
    });
    expect(sanitizeDraft({ weights: { food: -2, culture: 0.5 } }).weights).toEqual({
      food: 0,
      culture: 0.5,
    });
  });

  it('devine l’échelle quand le modèle répond sur dix', () => {
    // Observé sur un vrai fournisseur : « food: 8, nightlife: 9 » alors que la
    // consigne demandait 0 à 1. Écraser les deux à 1 perdrait le classement.
    expect(sanitizeDraft({ weights: { food: 8, nightlife: 9, culture: 0 } }).weights).toEqual({
      food: 0.89,
      nightlife: 1,
      culture: 0,
    });
  });

  it('ignore un objet de poids vide plutôt que d’écrire une clé vide', () => {
    expect(sanitizeDraft({ weights: {} })).toEqual({});
    expect(sanitizeDraft({ weights: 'beaucoup' })).toEqual({});
    expect(sanitizeDraft({ weights: [1, 2] })).toEqual({});
  });

  it('nettoie un nom de ville sans le réécrire', () => {
    expect(sanitizeDraft({ destination: '  Saint-Jacques-de-Compostelle  ' }).destination).toBe(
      'Saint-Jacques-de-Compostelle',
    );
    // Retours à la ligne et chevrons sautent : ce nom part dans une recherche,
    // et rien d'inattendu n'a de raison de le traverser.
    expect(sanitizeDraft({ destination: 'Rome\n<script>' }).destination).toBe('Rome script');
    expect(sanitizeDraft({ destination: 'X' })).toEqual({});
    expect(sanitizeDraft({ destination: 'a'.repeat(200) }).destination).toHaveLength(60);
  });

  it('ne fait rien d’une réponse qui n’est pas un objet', () => {
    expect(sanitizeDraft(null)).toEqual({});
    expect(sanitizeDraft('Bien sûr ! Voici le JSON :')).toEqual({});
    expect(sanitizeDraft([{ participants: 4 }])).toEqual({});
    expect(sanitizeDraft(undefined)).toEqual({});
  });

  it('ignore les champs inconnus au lieu de les recopier', () => {
    expect(sanitizeDraft({ participants: 3, adminRole: 'owner', trip_id: 'x' })).toEqual({
      participants: 3,
    });
  });

  it('sait dire qu’il n’a rien compris', () => {
    expect(draftIsEmpty(sanitizeDraft({ n_importe_quoi: true }))).toBe(true);
    expect(draftIsEmpty(sanitizeDraft({ participants: 2 }))).toBe(false);
  });
});
