import 'fake-indexeddb/auto';
import { Blob as BlobDeNode } from 'node:buffer';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DocumentDuVoyage } from '@tripora/core';
import {
  copieDe,
  copiesDuVoyage,
  garderUneCopie,
  oublierLaCopie,
  oublierLesCopiesDisparues,
  oublierToutesLesCopies,
} from './documentsHorsLigne';

function document(chemin: string, tripId = 'v1'): DocumentDuVoyage {
  return {
    id: chemin,
    tripId,
    nom: 'Billet',
    chemin,
    typeMime: 'application/pdf',
    taille: 3,
    prive: false,
    ajouteLe: '2026-09-24T10:00:00Z',
  };
}

beforeEach(async () => {
  await oublierToutesLesCopies();
});

describe('les documents gardés sur cet appareil', () => {
  it('rend la copie gardée, et rien pour un document jamais gardé', async () => {
    // Le Blob de jsdom ne traverse pas le clonage de la base simulée ; celui
    // de Node, comme celui d'un vrai navigateur, si.
    const billet = new BlobDeNode(['%PDF'], { type: 'application/pdf' }) as unknown as Blob;
    await garderUneCopie(document('v1/billet.pdf'), billet);
    const copie = await copieDe('v1/billet.pdf');
    expect(copie?.size).toBe(4);
    expect(await copie?.text()).toBe('%PDF');
    expect(await copieDe('v1/autre.pdf')).toBeUndefined();
  });

  it('dit, voyage par voyage, ce qui est gardé et combien ça pèse', async () => {
    await garderUneCopie(document('v1/a.pdf'), new Blob(['aaaa']));
    await garderUneCopie(document('v1/b.png'), new Blob(['bb']));
    await garderUneCopie(document('v2/c.pdf', 'v2'), new Blob(['c']));
    expect(await copiesDuVoyage('v1')).toEqual({ 'v1/a.pdf': 4, 'v1/b.png': 2 });
  });

  it('oublie les copies des documents qui ont quitté le coffre', async () => {
    await garderUneCopie(document('v1/reste.pdf'), new Blob(['x']));
    await garderUneCopie(document('v1/retire.pdf'), new Blob(['y']));
    await oublierLesCopiesDisparues('v1', new Set(['v1/reste.pdf']));
    expect(Object.keys(await copiesDuVoyage('v1'))).toEqual(['v1/reste.pdf']);
  });

  it('oublie une copie à la demande, et toutes à la déconnexion', async () => {
    await garderUneCopie(document('v1/a.pdf'), new Blob(['x']));
    await garderUneCopie(document('v1/b.pdf'), new Blob(['y']));
    await oublierLaCopie('v1/a.pdf');
    expect(Object.keys(await copiesDuVoyage('v1'))).toEqual(['v1/b.pdf']);
    await oublierToutesLesCopies();
    expect(await copiesDuVoyage('v1')).toEqual({});
  });
});
