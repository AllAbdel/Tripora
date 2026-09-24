import { describe, expect, it } from 'vitest';
import { DESTINATIONS } from './destinations.js';
import { besoinDAdaptateur, codeDuPays, infosPratiques, paysCouverts, tensionBasse } from './pays.js';

describe('les infos pratiques', () => {
  it('couvrent tous les pays du catalogue', () => {
    const couverts = new Set(paysCouverts());
    const manquants = [...new Set(DESTINATIONS.map((d) => d.countryCode))].filter((code) => !couverts.has(code));
    expect(manquants).toEqual([]);
  });

  it('n’emploient que des types de prise qui existent', () => {
    for (const code of paysCouverts()) {
      for (const prise of infosPratiques(code)!.prises) expect('ABCDEFGHIJKLMNO').toContain(prise);
    }
  });

  it('lisent les numéros d’urgence par service', () => {
    expect(infosPratiques('fr')!.urgences).toEqual([
      { service: null, numero: '112' },
      { service: 'ambulance', numero: '15' },
      { service: 'police', numero: '17' },
      { service: 'pompiers', numero: '18' },
    ]);
    expect(infosPratiques('US')!.urgences).toEqual([{ service: null, numero: '911' }]);
    // Sources discordantes : on ne donne pas de numéro plutôt qu'un faux.
    expect(infosPratiques('GA')!.urgences).toEqual([]);
  });

  it('savent de quel côté on roule', () => {
    expect(infosPratiques('GB')!.conduite).toBe('gauche');
    expect(infosPratiques('JP')!.conduite).toBe('gauche');
    expect(infosPratiques('TH')!.conduite).toBe('gauche');
    expect(infosPratiques('FR')!.conduite).toBe('droite');
    expect(infosPratiques('GI')!.conduite).toBe('droite');
  });
});

describe('faut-il un adaptateur ?', () => {
  it('pas d’un pays de prises E à un pays de prises F', () => {
    expect(besoinDAdaptateur('FR', 'DE')).toBe('aucun');
    expect(besoinDAdaptateur('BE', 'ES')).toBe('aucun');
    expect(besoinDAdaptateur('US', 'MX')).toBe('aucun');
  });

  it('pour les fiches épaisses seulement, en Suisse ou en Thaïlande', () => {
    expect(besoinDAdaptateur('FR', 'CH')).toBe('fiches-plates');
    expect(besoinDAdaptateur('FR', 'TH')).toBe('fiches-plates');
  });

  it('oui, d’Europe au Royaume-Uni, aux États-Unis, au Japon, en Australie', () => {
    for (const code of ['GB', 'US', 'JP', 'AU']) expect(besoinDAdaptateur('FR', code)).toBe('necessaire');
    expect(besoinDAdaptateur('GB', 'FR')).toBe('necessaire');
  });

  it('ne devine pas pour un pays inconnu', () => {
    expect(besoinDAdaptateur('FR', 'ZZ')).toBeUndefined();
    expect(besoinDAdaptateur(undefined, 'FR')).toBeUndefined();
  });
});

describe('le reste', () => {
  it('reconnaît le pays de départ à son nom', () => {
    expect(codeDuPays('France')).toBe('FR');
    expect(codeDuPays(' royaume-uni ')).toBe('GB');
    expect(codeDuPays('Atlantide')).toBeUndefined();
  });

  it('signale le courant faible des Amériques et du Japon', () => {
    expect(tensionBasse('120')).toBe(true);
    expect(tensionBasse('100')).toBe(true);
    expect(tensionBasse('230')).toBe(false);
    expect(tensionBasse('127 ou 220')).toBe(false);
  });
});

describe('le pays d’un point de départ qui ne le dit pas', () => {
  it('est celui de la ville connue la plus proche', async () => {
    const { paysDuPoint } = await import('./origins.js');
    expect(paysDuPoint({ lat: 48.8566, lng: 2.3522 })).toBe('France');
    expect(paysDuPoint({ lat: 51.5074, lng: -0.1278 })).toBe('Royaume-Uni');
    // En plein océan : on ne devine pas.
    expect(paysDuPoint({ lat: 30, lng: -40 })).toBeUndefined();
  });
});
