import { beforeEach, describe, expect, it } from 'vitest';
import { useTripDraft, type StepId, type TripDraft } from '@/stores/tripDraft';
import { AUCUN_CHOIX, etapeDeLaVisite, type ChoixDeLaVisite, type SituationDeLaVisite } from './etapesDeLaVisite';

const SOURCES = import.meta.glob<string>(['../../routes/**/*.tsx', '../**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

function brouillon(valeurs: Partial<TripDraft> = {}): TripDraft {
  return { ...useTripDraft.getState(), ...valeurs };
}

function creation(question: StepId, valeurs: Partial<TripDraft> = {}, choix: Partial<ChoixDeLaVisite> = {}) {
  return etapeDeLaVisite(
    { chemin: '/voyages/nouveau', question, identite: true },
    brouillon(valeurs),
    { ...AUCUN_CHOIX, ...choix },
  );
}

/** L'id de l'étape, ou « hors-du-chemin ». */
function id(situation: SituationDeLaVisite): string {
  return situation.etat === 'etape' ? situation.etape.id : situation.etat;
}

function texte(situation: SituationDeLaVisite): string | undefined {
  return situation.etat === 'etape' ? situation.etape.cibles[0]?.texte : undefined;
}

beforeEach(() => useTripDraft.getState().reset());

describe('la visite guidée, pas à pas', () => {
  it('commence au bouton qui crée un voyage : la liste avec un compte, l’accueil sans', () => {
    const avecCompte = etapeDeLaVisite({ chemin: '/voyages', question: null, identite: true }, brouillon(), AUCUN_CHOIX);
    expect(id(avecCompte)).toBe('nouveau');
    if (avecCompte.etat === 'etape') expect(avecCompte.etape.numero).toBe(1);
    expect(id(etapeDeLaVisite({ chemin: '/', question: null, identite: false }, brouillon(), AUCUN_CHOIX))).toBe('nouveau');
    // Ailleurs, la visite attend qu'on revienne.
    expect(id(etapeDeLaVisite({ chemin: '/profil', question: null, identite: true }, brouillon(), AUCUN_CHOIX))).toBe(
      'hors-du-chemin',
    );
    expect(id(etapeDeLaVisite({ chemin: '/voyages/nouveau', question: null, identite: true }, brouillon(), AUCUN_CHOIX))).toBe(
      'hors-du-chemin',
    );
  });

  it('attend un vrai choix à « Avec qui ? », même si la réponse par défaut est valide', () => {
    expect(id(creation('groupe'))).toBe('avec-qui');
    const suite = creation('groupe', {}, { avecQui: true });
    expect(id(suite)).toBe('groupe-continuer');
    expect(texte(suite)).toBe('Parfait. Appuyez sur « Continuer ».');
  });

  it('picore la ville de départ jusqu’à ce qu’elle soit choisie, puis montre « Continuer », plus brièvement', () => {
    const champ = creation('depart');
    expect(id(champ)).toBe('ville-depart');
    if (champ.etat === 'etape') expect(champ.etape.texteEnSaisie).toBe('Choisissez votre ville dans la liste.');
    const choisie = creation('depart', { origin: { name: 'Lyon', lat: 45.76, lng: 4.84 } });
    expect(id(choisie)).toBe('depart-continuer');
    expect(texte(choisie)).toBe('Appuyez sur « Continuer ».');
  });

  it('à « Où ? », un appui sur « Surprends-nous » suffit ; « On sait déjà » demande une ville', () => {
    expect(id(creation('destination'))).toBe('destination');
    expect(id(creation('destination', {}, { destination: true }))).toBe('destination-continuer');
    expect(id(creation('destination', { destinationMode: 'fixed' }, { destination: true }))).toBe('ville-destination');
    expect(id(creation('destination', { destinationMode: 'fixed', destinationIds: ['lisbonne'] }, { destination: true }))).toBe(
      'destination-continuer',
    );
  });

  it('à « Quand ? », la façon de dire quand, puis le mois ou les dates', () => {
    expect(id(creation('dates'))).toBe('quand');
    expect(texte(creation('dates', {}, { quand: true }))).toBe('Choisissez le mois du départ.');
    expect(texte(creation('dates', { dateMode: 'exact' }, { quand: true }))).toBe('Indiquez le départ et le retour.');
    // Un mois touché directement vaut réponse.
    expect(id(creation('dates', { month: 7 }))).toBe('dates-continuer');
    expect(id(creation('dates', { dateMode: 'weekend' }, { quand: true }))).toBe('dates-continuer');
  });

  it('picore le budget, avec la place de l’unité', () => {
    const montant = creation('budget');
    expect(id(montant)).toBe('budget-montant');
    if (montant.etat === 'etape') expect(montant.etape.unite).toBe(true);
    expect(id(creation('budget', { budgetMode: 'cheapest' }))).toBe('budget-continuer');
  });

  it('s’arrête sur « Créer le voyage », sans appuyer dessus', () => {
    expect(id(creation('envies'))).toBe('envies');
    const fin = creation('envies', { weights: { culture: 1 } });
    expect(id(fin)).toBe('fin');
    if (fin.etat !== 'etape') throw new Error(fin.etat);
    expect(fin.etape).toMatchObject({ numero: 8, fin: true });
    expect(texte(fin)).toContain('Rien n’est créé tant que vous n’appuyez pas dessus.');
    // Sans compte, le bouton enregistre : la phrase le dit.
    const sansCompte = etapeDeLaVisite(
      { chemin: '/voyages/nouveau', question: 'envies', identite: false },
      brouillon({ weights: { culture: 1 } }),
      AUCUN_CHOIX,
    );
    expect(texte(sansCompte)).toContain('avec un compte gratuit');
  });

  it('trouve chaque repère dans le code des écrans', () => {
    // Retirer un `data-guide` en retouchant un écran laisserait Plumio montrer
    // le vide : ce test le rattrape.
    const code = Object.values(SOURCES).join('\n');
    const situations: SituationDeLaVisite[] = [
      etapeDeLaVisite({ chemin: '/voyages', question: null, identite: true }, brouillon(), AUCUN_CHOIX),
      creation('groupe'),
      creation('groupe', {}, { avecQui: true }),
      creation('depart'),
      creation('destination'),
      creation('destination', { destinationMode: 'fixed' }, { destination: true }),
      creation('dates'),
      creation('dates', {}, { quand: true }),
      creation('budget'),
      creation('envies'),
    ];
    for (const situation of situations) {
      if (situation.etat !== 'etape') throw new Error('hors du chemin');
      for (const { ancre } of situation.etape.cibles) {
        expect(code.includes(`data-guide="${ancre}"`) || code.includes(`ancreDuPremierAxe="${ancre}"`), ancre).toBe(true);
      }
    }
  });
});
