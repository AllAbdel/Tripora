import { describe, expect, it } from 'vitest';
import { datePlausible, montantSaisi } from './lectureDuTicket';

describe('ce que le scan met dans le formulaire', () => {
  it('écrit le montant comme on le taperait', () => {
    expect(montantSaisi(5350)).toBe('53,50');
    expect(montantSaisi(700)).toBe('7,00');
  });

  it('ne garde une date lue que si elle tient debout', () => {
    expect(datePlausible('2026-09-28', '2026-10-02')).toBe('2026-09-28');
    // Dans le futur : un chiffre mal lu.
    expect(datePlausible('2026-11-28', '2026-10-02')).toBeNull();
    // Un « 01/02/03 » devenu 2003 : trop vieux pour ce voyage.
    expect(datePlausible('2003-02-01', '2026-10-02')).toBeNull();
    expect(datePlausible(null, '2026-10-02')).toBeNull();
  });
});
