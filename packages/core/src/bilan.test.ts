import { describe, expect, it } from 'vitest';
import { bilanDuVoyage, commeLeTourDeLaTerre, type DonneesDuBilan } from './bilan.js';
import { formatCents } from './money.js';

const PARIS = { lat: 48.8566, lng: 2.3522 };
const UBUD = { lat: -8.5069, lng: 115.2625 };

const euros = (cents: number) => formatCents(cents, 'EUR', { hideCentimes: true });

const BALI: DonneesDuBilan = {
  ville: 'Ubud',
  pays: 'Indonésie',
  debut: '2026-10-10',
  fin: '2026-10-17',
  participants: 4,
  origine: PARIS,
  destination: UBUD,
  depenses: [
    { montantCents: 160_000, categorie: 'Hébergement' },
    { montantCents: 80_000, categorie: 'Nourriture' },
    { montantCents: 40_000, categorie: 'Activités' },
  ],
  programme: [
    { kind: 'activity', title: 'Rizières de Tegallalang' },
    { kind: 'activity', title: 'Cours de cuisine' },
    { kind: 'meal', title: 'Warung Biah Biah' },
    { kind: 'evening', title: 'Danse Kecak' },
    { kind: 'transit', title: 'Aéroport' },
    { kind: 'activity', title: '  ' },
  ],
  coupDeCoeur: { titre: 'Cours de cuisine', pour: 3 },
};

describe('bilanDuVoyage', () => {
  it('raconte le voyage en chiffres justes', () => {
    const bilan = bilanDuVoyage(BALI);
    expect(bilan).toMatchObject({
      jours: 8,
      nuits: 7,
      activites: 2,
      repas: 1,
      soirees: 1,
      totalCents: 280_000,
      parPersonneCents: 70_000,
      parJourCents: 8_750,
      premierPoste: { categorie: 'Hébergement', part: 57 },
      coupDeCoeur: { titre: 'Cours de cuisine', pour: 3, sur: 4 },
    });
    // Paris–Ubud : un peu plus de 12 000 km, aller-retour.
    expect(bilan.km).toBeGreaterThan(24_000);
    expect(bilan.km).toBeLessThan(25_000);
    expect(bilan.phrases.map((phrase) => phrase.texte)).toEqual([
      '8 jours, 7 nuits',
      `${bilan.km!.toLocaleString('fr-FR')} km aller-retour, 62 % du tour de la Terre`,
      '2 activités, 1 repas, 1 soirée',
      `${euros(70_000)} par personne, ${euros(8_750)} par jour`,
      'Premier poste : hébergement (57 %)',
      'Le coup de cœur du groupe : Cours de cuisine (3 sur 4)',
    ]);
    expect(bilan.phrases.map((phrase) => phrase.sujet)).toEqual([
      'duree',
      'distance',
      'programme',
      'depenses',
      'poste',
      'coup-de-coeur',
    ]);
  });

  it('se tait sur ce qu’il ne sait pas', () => {
    const bilan = bilanDuVoyage({
      ...BALI,
      debut: null,
      fin: null,
      origine: null,
      depenses: [],
      programme: [],
      coupDeCoeur: null,
    });
    expect(bilan).toMatchObject({ jours: null, km: null, parPersonneCents: null, premierPoste: null, coupDeCoeur: null });
    expect(bilan.phrases).toEqual([]);
  });

  it('parle autrement d’un voyage en solo', () => {
    const bilan = bilanDuVoyage({ ...BALI, participants: 1, coupDeCoeur: { titre: 'Kecak', pour: 1 } });
    const textes = bilan.phrases.map((phrase) => phrase.texte);
    expect(textes).toContain(`${euros(280_000)} dépensés, ${euros(35_000)} par jour`);
    expect(textes).toContain('Le coup de cœur : Kecak');
  });

  it('ne donne pas de premier poste quand il n’y a qu’une catégorie', () => {
    const bilan = bilanDuVoyage({ ...BALI, depenses: [{ montantCents: 1000, categorie: 'Nourriture' }] });
    expect(bilan.premierPoste).toBeNull();
  });
});

describe('commeLeTourDeLaTerre', () => {
  it('compare au tour de la Terre, sans arrondir à la louche', () => {
    expect(commeLeTourDeLaTerre(900)).toBeNull();
    expect(commeLeTourDeLaTerre(4_000)).toBe('10 % du tour de la Terre');
    expect(commeLeTourDeLaTerre(24_500)).toBe('61 % du tour de la Terre');
    expect(commeLeTourDeLaTerre(40_000)).toBe('le tour de la Terre');
    expect(commeLeTourDeLaTerre(100_000)).toBe('2,5 fois le tour de la Terre');
  });
});
