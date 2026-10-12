import { describe, expect, it } from 'vitest';
import { CARBURANT_DU_MONDE } from './carburant-du-monde.js';
import {
  FORFAIT_VOITURE_PAR_KM_CENTIMES,
  RELEVE_DU_CARBURANT,
  coutVoitureAuKm,
  prixDuCarburant,
} from './carburant.js';
import { estimateTransportOptions } from './transport.js';
import { DESTINATIONS } from './catalog/destinations.js';

describe('le prix du carburant (OpenVan)', () => {
  it('un relevé daté, et des prix plausibles au litre', () => {
    expect(RELEVE_DU_CARBURANT).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    for (const [code, [essence, gazole]] of Object.entries(CARBURANT_DU_MONDE)) {
      expect(code).toMatch(/^[A-Z]{2}$/u);
      for (const prix of [essence, gazole]) if (prix !== null) expect(prix).toBeGreaterThanOrEqual(2);
      for (const prix of [essence, gazole]) if (prix !== null) expect(prix).toBeLessThanOrEqual(500);
    }
  });

  it('couvre les pays des destinations européennes du catalogue', () => {
    const europeens = ['FR', 'ES', 'IT', 'DE', 'PT', 'CZ', 'GB', 'CH', 'BE', 'NL'];
    for (const code of europeens) expect(prixDuCarburant(code)?.essence, code).toBeGreaterThan(0);
    const pays = [...new Set(DESTINATIONS.map((d) => d.countryCode))];
    const manquants = pays.filter((c) => !prixDuCarburant(c));
    // Surtout des îles et des micro-États, que la voiture ne rejoint guère :
    // ils gardent le forfait.
    expect(manquants.length / pays.length).toBeLessThan(0.3);
  });

  it('fait la moyenne du départ et de l’arrivée, péages compris', () => {
    const fr = prixDuCarburant('FR')!.essence!;
    const es = prixDuCarburant('ES')!.essence!;
    const cout = coutVoitureAuKm('FR', 'ES');
    expect(cout.releve).toBe(true);
    expect(cout.centimes).toBeCloseTo(((fr + es) / 2) * 0.065 + 3, 5);
    // Un seul pays connu suffit.
    expect(coutVoitureAuKm('fr', 'XX').centimes).toBeCloseTo(fr * 0.065 + 3, 5);
  });

  it('garde l’ancien forfait quand aucun pays n’est connu, sans prétendre au relevé', () => {
    expect(coutVoitureAuKm(undefined, 'XX')).toEqual({ centimes: FORFAIT_VOITURE_PAR_KM_CENTIMES, releve: false });
  });

  it('la voiture partagée suit le pays : un nom de départ, un code de destination', () => {
    const paris = { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 };
    const madrid = DESTINATIONS.find((d) => d.countryCode === 'ES')!;
    const voiture = estimateTransportOptions(paris, madrid, 4).find((o) => o.mode === 'car');
    expect(voiture?.carburantReleve).toBe(true);

    const anonyme = estimateTransportOptions({ lat: 48.8566, lng: 2.3522 }, { lat: 45.76, lng: 4.84 }, 4).find(
      (o) => o.mode === 'car',
    );
    expect(anonyme?.carburantReleve).toBe(false);
  });
});
