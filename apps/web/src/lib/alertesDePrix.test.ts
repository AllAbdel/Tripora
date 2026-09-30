import { describe, expect, it } from 'vitest';
import type { TripConstraints } from '@tripora/core';
import {
  alerteDepuisLaBase,
  depuisBase64url,
  libelleDuMois,
  memeTrajet,
  ouEnEstLePrix,
  trajetDuVoyage,
  type SuiviDePrix,
} from './alertesDePrix';

function constraints(overrides: Partial<TripConstraints> = {}): TripConstraints {
  return {
    participants: 4,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['PAR'] },
    durationDays: 5,
    dateMode: 'month',
    month: 6,
    budgetMode: 'cheapest',
    budgetPerPersonCents: null,
    comfortLevel: 'budget',
    groupType: 'friends',
    ...overrides,
  };
}

const LISBONNE = { id: 'lisbonne', name: 'Lisbonne', iata: ['LIS'] };
const FIN_SEPTEMBRE = new Date('2026-09-30T08:00:00Z');

function suivi(overrides: Partial<SuiviDePrix> = {}): SuiviDePrix {
  return {
    id: 's1',
    tripId: 'v1',
    origine: 'PAR',
    destinationId: 'lisbonne',
    destinationNom: 'Lisbonne',
    mois: '2027-06',
    premierCents: 18_000,
    dernierCents: 15_900,
    plusBasCents: 15_900,
    releveLe: '2026-09-30T06:41:00Z',
    ...overrides,
  };
}

describe('le trajet à suivre depuis un voyage', () => {
  it('prend le même aéroport et le même mois que les propositions', () => {
    // « En juin », dit fin septembre : juin prochain.
    expect(trajetDuVoyage('v1', constraints(), LISBONNE, FIN_SEPTEMBRE)).toEqual({
      tripId: 'v1',
      origine: 'PAR',
      destinationId: 'lisbonne',
      destinationNom: 'Lisbonne',
      destinationIata: ['LIS'],
      mois: '2027-06',
    });
  });

  it('suit le mois du départ quand les dates sont fixées', () => {
    const trajet = trajetDuVoyage(
      'v1',
      constraints({ dateMode: 'exact', startDate: '2026-11-12', endDate: '2026-11-16' }),
      LISBONNE,
      FIN_SEPTEMBRE,
    );
    expect(trajet?.mois).toBe('2026-11');
  });

  it('ne propose rien sans aéroport, sans mois, ou pour un mois passé', () => {
    expect(trajetDuVoyage('v1', constraints({ origin: { name: 'Annecy', lat: 45.9, lng: 6.12 } }), LISBONNE, FIN_SEPTEMBRE)).toBeNull();
    expect(trajetDuVoyage('v1', constraints(), { ...LISBONNE, iata: [] }, FIN_SEPTEMBRE)).toBeNull();
    expect(trajetDuVoyage('v1', constraints({ dateMode: 'weekend', month: undefined }), LISBONNE, FIN_SEPTEMBRE)).toBeNull();
    expect(
      trajetDuVoyage('v1', constraints({ dateMode: 'exact', startDate: '2026-08-01' }), LISBONNE, FIN_SEPTEMBRE),
    ).toBeNull();
  });

  it('reconnaît un suivi existant pour le même trajet', () => {
    const trajet = trajetDuVoyage('v2', constraints(), LISBONNE, FIN_SEPTEMBRE)!;
    // Suivi depuis un autre voyage : c'est le même vol.
    expect(memeTrajet(suivi({ tripId: 'autre' }), trajet)).toBe(true);
    expect(memeTrajet(suivi({ mois: '2027-07' }), trajet)).toBe(false);
  });
});

describe('ce que l’écran dit du prix', () => {
  it('nomme le mois en toutes lettres', () => {
    expect(libelleDuMois('2027-06')).toBe('juin 2027');
    expect(libelleDuMois('n’importe quoi')).toBe('n’importe quoi');
  });

  it('attend le premier relevé avant de comparer', () => {
    expect(ouEnEstLePrix(suivi({ premierCents: null, dernierCents: null }))).toMatch(/Premier relevé/);
    expect(ouEnEstLePrix(suivi({ premierCents: 15_900 }))).toMatch(/^159\s€ aller-retour au dernier relevé/);
  });

  it('dit de combien le prix a bougé depuis le début du suivi', () => {
    expect(ouEnEstLePrix(suivi())).toMatch(/21\s€ de moins/);
    expect(ouEnEstLePrix(suivi({ dernierCents: 19_000 }))).toMatch(/10\s€ de plus/);
  });
});

describe('lecture des alertes', () => {
  it('ignore une alerte dont le suivi vient d’être arrêté', () => {
    expect(
      alerteDepuisLaBase({
        id: 'a1',
        old_cents: 18_000,
        new_cents: 15_900,
        created_at: '2026-09-30T06:41:00Z',
        seen_at: null,
        price_watches: null,
      }),
    ).toBeNull();
  });

  it('rattache l’alerte à son trajet', () => {
    expect(
      alerteDepuisLaBase({
        id: 'a1',
        old_cents: 18_000,
        new_cents: 15_900,
        created_at: '2026-09-30T06:41:00Z',
        seen_at: null,
        price_watches: { destination_name: 'Lisbonne', month: '2027-06', origin_iata: 'PAR', trip_id: 'v1' },
      }),
    ).toMatchObject({ destinationNom: 'Lisbonne', origine: 'PAR', tripId: 'v1', vueLe: null });
  });
});

describe('clé publique des notifications', () => {
  it('redonne les 65 octets d’une clé P-256 brute', () => {
    // 0x04 suivi de 64 octets : la forme non compressée qu'attend le navigateur.
    const octets = Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : i));
    const texte = btoa(String.fromCharCode(...octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    expect([...depuisBase64url(texte)]).toEqual([...octets]);
  });
});
