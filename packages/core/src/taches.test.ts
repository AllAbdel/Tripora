import { describe, expect, it } from 'vitest';
import {
  etatDeLEcheance,
  resumerLesTaches,
  suggestionsRestantes,
  trierLesTaches,
  type Tache,
} from './taches.js';

function tache(modif: Partial<Tache> & { id: string }): Tache {
  return {
    tripId: 'v1',
    titre: modif.id,
    responsable: null,
    echeance: null,
    faite: false,
    creeLe: '2026-09-01T10:00:00Z',
    ...modif,
  };
}

const AUJOURDHUI = '2026-09-24';

describe('les échéances', () => {
  it('en retard, aujourd’hui, bientôt, plus tard', () => {
    expect(etatDeLEcheance('2026-09-20', AUJOURDHUI)).toBe('en-retard');
    expect(etatDeLEcheance('2026-09-24', AUJOURDHUI)).toBe('aujourdhui');
    expect(etatDeLEcheance('2026-09-27', AUJOURDHUI)).toBe('bientot');
    expect(etatDeLEcheance('2026-09-28', AUJOURDHUI)).toBe('plus-tard');
    expect(etatDeLEcheance(null, AUJOURDHUI)).toBeNull();
  });
});

describe('l’ordre de la liste', () => {
  it('le plus pressé d’abord, sans échéance ensuite, le fait à la fin', () => {
    const triees = trierLesTaches([
      tache({ id: 'sans-date' }),
      tache({ id: 'faite-avant', faite: true, faiteLe: '2026-09-10T00:00:00Z' }),
      tache({ id: 'octobre', echeance: '2026-10-01' }),
      tache({ id: 'faite-hier', faite: true, faiteLe: '2026-09-23T00:00:00Z' }),
      tache({ id: 'septembre', echeance: '2026-09-25' }),
    ]);
    expect(triees.map((t) => t.id)).toEqual(['septembre', 'octobre', 'sans-date', 'faite-hier', 'faite-avant']);
  });
});

describe('le résumé', () => {
  it('compte ce qui reste, ce qui m’attend, ce qui est en retard', () => {
    expect(
      resumerLesTaches(
        [
          tache({ id: 'a', responsable: 'moi', echeance: '2026-09-20' }),
          tache({ id: 'b', responsable: 'lea' }),
          tache({ id: 'c', responsable: 'moi', faite: true }),
        ],
        'moi',
        AUJOURDHUI,
      ),
    ).toEqual({ aFaire: 2, pourMoi: 1, enRetard: 1 });
  });
});

describe('les suggestions', () => {
  it('ne proposent pas ce qui est déjà dans la liste, accents et casse compris', () => {
    const restantes = suggestionsRestantes([{ titre: 'reserver le LOGEMENT ' }]);
    expect(restantes).not.toContain('Réserver le logement');
    expect(restantes).toContain('Louer une voiture');
  });
});
