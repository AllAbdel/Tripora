import { describe, expect, it } from 'vitest';
import { instantLocal, numeroDuRappel, rappelsDuVoyage, type VoyageARappeler } from './rappels.js';
import type { Reservation } from './reservations.js';
import type { Tache } from './taches.js';

const PARIS = 'Europe/Paris';
const BALI = 'Asia/Makassar';

const VOYAGE: VoyageARappeler = { id: 'v1', ville: 'Ubud', debut: '2026-10-10', fin: '2026-10-17', fuseau: BALI };
const MAINTENANT = new Date('2026-10-01T08:00:00Z');

function reservation(partiel: Partial<Reservation>): Reservation {
  return {
    id: 'r1',
    tripId: 'v1',
    type: 'activite',
    fournisseur: 'autre',
    titre: 'Cours de cuisine',
    debutLe: '2026-10-12',
    devise: 'EUR',
    ...partiel,
  };
}

function tache(partiel: Partial<Tache>): Tache {
  return {
    id: 't1',
    tripId: 'v1',
    titre: 'Prendre l’assurance',
    responsable: 'moi',
    echeance: '2026-10-05',
    faite: false,
    creeLe: '2026-09-20T10:00:00Z',
    ...partiel,
  };
}

describe('instantLocal', () => {
  it('lit une heure dans le fuseau donné', () => {
    // 19 h à Paris le 9 octobre (heure d'été) : 17 h UTC.
    expect(instantLocal('2026-10-09', '19:00', PARIS).toISOString()).toBe('2026-10-09T17:00:00.000Z');
    // 10 h à Bali : 2 h UTC.
    expect(instantLocal('2026-10-12', '10:00', BALI).toISOString()).toBe('2026-10-12T02:00:00.000Z');
  });

  it('compte le changement d’heure', () => {
    // Le 25 octobre 2026, Paris repasse à l'heure d'hiver : 19 h = 18 h UTC.
    expect(instantLocal('2026-10-25', '19:00', PARIS).toISOString()).toBe('2026-10-25T18:00:00.000Z');
  });
});

describe('numeroDuRappel', () => {
  it('est stable, positif, et distingue les rappels', () => {
    expect(numeroDuRappel('v1:veille')).toBe(numeroDuRappel('v1:veille'));
    expect(numeroDuRappel('v1:veille')).toBeGreaterThan(0);
    expect(numeroDuRappel('v1:veille')).toBeLessThanOrEqual(0x7fffffff);
    expect(numeroDuRappel('v1:veille')).not.toBe(numeroDuRappel('v2:veille'));
  });
});

describe('rappelsDuVoyage', () => {
  it('rappelle la veille du départ au soir, et le lendemain du retour', () => {
    const rappels = rappelsDuVoyage(VOYAGE, { maintenant: MAINTENANT, fuseauDuTelephone: PARIS });
    expect(rappels.map((r) => [r.genre, r.quand.toISOString(), r.titre])).toEqual([
      ['veille-du-depart', '2026-10-09T17:00:00.000Z', 'Départ demain pour Ubud'],
      ['retour', '2026-10-18T16:00:00.000Z', 'Bon retour !'],
    ]);
    expect(rappels[1]?.lien).toBe('/voyages/v1/budget');
  });

  it('renvoie la veille vers la valise et le coffre', () => {
    const [veille] = rappelsDuVoyage(VOYAGE, { maintenant: MAINTENANT, fuseauDuTelephone: PARIS });
    expect(veille?.texte).toMatch(/valise et au coffre/u);
  });

  it('rappelle mes tâches le matin de leur échéance, pas celles des autres', () => {
    const rappels = rappelsDuVoyage(
      { ...VOYAGE, debut: null, fin: null },
      {
        maintenant: MAINTENANT,
        fuseauDuTelephone: PARIS,
        moi: 'moi',
        taches: [
          tache({}),
          tache({ id: 't2', responsable: 'lea' }),
          tache({ id: 't3', faite: true }),
          tache({ id: 't4', echeance: null }),
        ],
      },
    );
    expect(rappels).toHaveLength(1);
    expect(rappels[0]).toMatchObject({ genre: 'tache', texte: 'Prendre l’assurance', lien: '/voyages/v1/qui-fait-quoi' });
    expect(rappels[0]?.quand.toISOString()).toBe('2026-10-05T07:00:00.000Z');
  });

  it('rappelle un vol trois heures avant, à l’heure du départ', () => {
    const rappels = rappelsDuVoyage(
      { ...VOYAGE, fin: null },
      {
        maintenant: MAINTENANT,
        fuseauDuTelephone: PARIS,
        reservations: [
          // L'aller : il part de Paris, à l'heure de Paris.
          reservation({ id: 'aller', type: 'transport', titre: 'Vol GA-881', debutLe: '2026-10-10', debutA: '14:30', reference: 'X7K2P' }),
          // Le retour : il part de Bali, à l'heure de Bali.
          reservation({ id: 'retour', type: 'transport', titre: 'Vol GA-882', debutLe: '2026-10-17', debutA: '09:00' }),
        ],
      },
    );
    const vols = rappels.filter((r) => r.genre === 'reservation');
    expect(vols.map((r) => [r.titre, r.quand.toISOString(), r.texte])).toEqual([
      ['Dans 3 h : Vol GA-881', '2026-10-10T09:30:00.000Z', 'Départ à 14:30 · référence X7K2P'],
      ['Dans 3 h : Vol GA-882', '2026-10-16T22:00:00.000Z', 'Départ à 09:00'],
    ]);
  });

  it('rappelle une visite une heure avant, un hébergement le jour de l’arrivée', () => {
    const rappels = rappelsDuVoyage(
      { ...VOYAGE, debut: null, fin: null },
      {
        maintenant: MAINTENANT,
        fuseauDuTelephone: PARIS,
        reservations: [
          reservation({ id: 'cuisine', debutA: '10:00', adresse: 'Jl. Raya Ubud 12' }),
          reservation({ id: 'villa', type: 'hebergement', titre: 'Villa Sari', debutLe: '2026-10-10', debutA: '15:00' }),
          reservation({ id: 'sans-heure', type: 'hebergement', titre: 'Hôtel Kuta', debutLe: '2026-10-14' }),
          // Une visite sans heure ne se rappelle pas : on ne saurait pas quand.
          reservation({ id: 'musee', titre: 'Musée', debutA: null }),
        ],
      },
    );
    expect(rappels.map((r) => [r.titre, r.quand.toISOString(), r.texte])).toEqual([
      ['Arrivée aujourd’hui : Villa Sari', '2026-10-10T05:00:00.000Z', 'L’adresse et les codes d’accès sont dans le coffre du voyage.'],
      ['Dans 1 h : Cours de cuisine', '2026-10-12T01:00:00.000Z', 'Jl. Raya Ubud 12'],
      ['Arrivée aujourd’hui : Hôtel Kuta', '2026-10-14T04:00:00.000Z', 'L’adresse et les codes d’accès sont dans le coffre du voyage.'],
    ]);
  });

  it('ne pose ni rappel passé, ni rappel trop lointain', () => {
    const passe = rappelsDuVoyage(VOYAGE, { maintenant: new Date('2026-10-12T00:00:00Z'), fuseauDuTelephone: PARIS });
    expect(passe.map((r) => r.genre)).toEqual(['retour']);
    const lointain = rappelsDuVoyage(VOYAGE, { maintenant: new Date('2026-06-01T00:00:00Z'), fuseauDuTelephone: PARIS });
    expect(lointain).toEqual([]);
  });

  it('garde le même numéro d’un calcul à l’autre', () => {
    const avant = rappelsDuVoyage(VOYAGE, { maintenant: MAINTENANT, fuseauDuTelephone: PARIS });
    const apres = rappelsDuVoyage(VOYAGE, { maintenant: new Date('2026-10-02T08:00:00Z'), fuseauDuTelephone: PARIS });
    expect(apres.map((r) => r.id)).toEqual(avant.map((r) => r.id));
  });
});
