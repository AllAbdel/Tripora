import { describe, expect, it } from 'vitest';
import { findDestination } from './catalog/destinations.js';
import { affilierLiens, liensDeRubrique } from './booking.js';
import { PARTENAIRES, partenairesDe, TITRES_DES_RUBRIQUES, type RubriqueDePartenaire } from './partenaires.js';

const TRIPORA = { marker: '774322', projet: '570857' };

describe('les partenaires Travelpayouts', () => {
  it('ont tous de quoi être attribués : des numéros relevés, ou le lien court', () => {
    for (const partenaire of PARTENAIRES) {
      const attribuable = Boolean(partenaire.numeros) || Boolean(partenaire.lienCourt);
      expect(attribuable, partenaire.id).toBe(true);
      if (partenaire.numeros) {
        expect(partenaire.numeros.programme, partenaire.id).toMatch(/^\d{1,6}$/u);
        expect(partenaire.numeros.campagne, partenaire.id).toMatch(/^\d{1,6}$/u);
      }
      if (partenaire.lienCourt) expect(partenaire.lienCourt, partenaire.id).toMatch(/^https:\/\/[a-z]+\.tpk\.lu\/\w+$/u);
      expect(partenaire.accueil, partenaire.id).toMatch(/^https:\/\//u);
    }
    expect(new Set(PARTENAIRES.map((p) => p.id)).size).toBe(PARTENAIRES.length);
  });

  it('se rangent par ordre alphabétique, jamais par ce qu’ils rapportent', () => {
    for (const rubrique of Object.keys(TITRES_DES_RUBRIQUES) as RubriqueDePartenaire[]) {
      const noms = partenairesDe(rubrique, findDestination('bangkok')!).map((p) => p.nom);
      expect(noms.length, rubrique).toBeGreaterThan(0);
      expect(noms, rubrique).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr')));
    }
  });

  it('ne proposent KKday qu’en Asie', () => {
    const ids = (id: string) => partenairesDe('activites', findDestination(id)!).map((p) => p.id);
    expect(ids('bangkok')).toContain('kkday');
    expect(ids('lisbonne')).not.toContain('kkday');
  });

  it('passent par Travelpayouts, lien court compris', () => {
    const transferts = affilierLiens(liensDeRubrique('transfert'), TRIPORA);
    for (const lien of transferts) expect(lien.affilie, lien.id).toBe(true);
    expect(transferts.find((lien) => lien.id === 'intui')?.url).toBe('https://intui.tpk.lu/PKSyCQJp');
    const kiwitaxi = new URL(transferts.find((lien) => lien.id === 'kiwitaxi')!.url);
    expect(kiwitaxi.searchParams.get('p')).toBe('647');
    expect(kiwitaxi.searchParams.get('u')).toBe('https://kiwitaxi.com/');
  });

  it('restent des liens ordinaires sans identité de partenaire', () => {
    const esim = affilierLiens(liensDeRubrique('internet'), undefined);
    for (const lien of esim) {
      expect(lien.affilie, lien.id).toBeUndefined();
      expect(lien.url, lien.id).not.toContain('tpk.lu');
      expect(lien.url, lien.id).not.toContain('tp.media');
    }
  });
});
