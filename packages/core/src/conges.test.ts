import { describe, expect, it } from 'vitest';
import {
  calendrierConnuJusquau,
  cePendant,
  dimancheDePaques,
  joursFeries,
  pontsEntre,
  VACANCES_SCOLAIRES,
  vacancesAVenir,
  zoneProbable,
} from './conges.js';

describe('les jours fériés', () => {
  it('place Pâques et les fêtes qui en dépendent', () => {
    expect(dimancheDePaques(2026)).toBe('2026-04-05');
    expect(dimancheDePaques(2027)).toBe('2027-03-28');
    expect(dimancheDePaques(2028)).toBe('2028-04-16');
    const feries = joursFeries(2026);
    expect(feries).toHaveLength(11);
    expect(feries.find((jour) => jour.nom === 'Ascension')?.date).toBe('2026-05-14');
    expect(feries.find((jour) => jour.nom === 'Lundi de Pentecôte')?.date).toBe('2026-05-25');
  });
});

describe('les ponts', () => {
  const ponts = pontsEntre('2026-01-01', '2026-12-31');
  const du = (date: string) => ponts.find((pont) => pont.debut === date || pont.fin === date);

  it('donne trois jours pour un vendredi férié, sans rien poser', () => {
    // Le 1er mai 2026 est un vendredi.
    expect(du('2026-05-01')).toMatchObject({ debut: '2026-05-01', fin: '2026-05-03', jours: 3, aPoser: 0 });
  });

  it('donne quatre jours pour un mardi ou un jeudi, un jour posé', () => {
    // 14 juillet 2026 : un mardi.
    expect(du('2026-07-14')).toMatchObject({ debut: '2026-07-11', jours: 4, aPoser: 1 });
    // Ascension : toujours un jeudi.
    expect(du('2026-05-14')).toMatchObject({ fin: '2026-05-17', jours: 4, aPoser: 1 });
  });

  it('donne cinq jours pour un mercredi, deux posés', () => {
    // 11 novembre 2026 : un mercredi.
    expect(du('2026-11-11')).toMatchObject({ fin: '2026-11-15', jours: 5, aPoser: 2 });
  });

  it('ne propose rien pour un férié tombé le week-end', () => {
    // 15 août 2026 : un samedi ; 1er novembre 2026 : un dimanche.
    expect(ponts.some((pont) => pont.nom === 'Assomption')).toBe(false);
    expect(ponts.some((pont) => pont.nom === 'Toussaint')).toBe(false);
  });
});

describe('les vacances scolaires', () => {
  it('se suivent dans l’ordre, chaque période bien formée', () => {
    for (const periode of VACANCES_SCOLAIRES) {
      expect(periode.debut <= periode.fin, periode.nom).toBe(true);
      expect(periode.zones.length).toBeGreaterThan(0);
    }
  });

  it('distingue les zones au printemps', () => {
    const c = vacancesAVenir('2027-03-01', 'C', 3);
    expect(c[0]).toMatchObject({ nom: 'Vacances de printemps (zone C)', debut: '2027-04-03', fin: '2027-04-18' });
    const a = vacancesAVenir('2027-03-01', 'A', 3);
    expect(a[0]!.debut).toBe('2027-04-10');
  });

  it('part d’aujourd’hui quand les vacances ont commencé', () => {
    const [ete] = vacancesAVenir('2027-08-10', 'B', 1);
    expect(ete).toMatchObject({ debut: '2027-08-10', fin: '2027-09-01' });
  });

  it('dit ce que des dates recoupent', () => {
    const recoupe = cePendant('2026-10-20', '2026-10-25', 'A');
    expect(recoupe.vacances.map((periode) => periode.nom)).toEqual(['Vacances de la Toussaint']);
    expect(cePendant('2026-04-30', '2026-05-02', null).feries.map((jour) => jour.nom)).toEqual([
      'Fête du Travail',
    ]);
  });

  it('rappelle de compléter le calendrier avant qu’il ne s’épuise', () => {
    // Quand ce test échoue, publier l'année scolaire suivante dans conges.ts
    // (jeu « Calendrier scolaire » de data.education.gouv.fr).
    const aujourdHui = new Date().toISOString().slice(0, 10);
    const dansUnAn = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    expect(calendrierConnuJusquau() > aujourdHui).toBe(true);
    expect(calendrierConnuJusquau() >= dansUnAn.slice(0, 4) + '-01-01').toBe(true);
  });
});

describe('la zone du départ', () => {
  it('se devine d’après la ville, en France seulement', () => {
    expect(zoneProbable({ lat: 45.764, lng: 4.8357, country: 'France' })).toBe('A');
    expect(zoneProbable({ lat: 48.8566, lng: 2.3522 })).toBe('C');
    expect(zoneProbable({ lat: 43.2965, lng: 5.3698 })).toBe('B');
    // Pau relève de Bordeaux, bien que Toulouse soit plus proche.
    expect(zoneProbable({ lat: 43.2951, lng: -0.3708, country: 'France' })).toBe('A');
    expect(zoneProbable({ lat: 38.7223, lng: -9.1393, country: 'Portugal' })).toBeNull();
  });
});
