import { describe, expect, it } from 'vitest';
import { evenementsDuProgramme, nomDuFichier, programmeDate } from './calendrier';
import type { ItineraryDayView } from './itinerary';

function jour(date: string | null, titres: string[]): ItineraryDayView {
  return {
    id: `j-${date}`,
    dayIndex: 1,
    date,
    summary: '',
    items: titres.map((title, position) => ({
      id: `${date}-${position}`,
      kind: 'activity',
      axis: 'culture',
      title,
      startTime: '09:00',
      endTime: null,
      costCents: position === 0 ? 4500 : 0,
      notes: position === 0 ? 'Du carnet d’activités.' : null,
      reason: null,
      forUserId: null,
      position,
    })),
  };
}

describe('le programme vers le calendrier', () => {
  it('n’exporte qu’un programme entièrement daté', () => {
    expect(programmeDate([jour('2026-07-10', ['Batur'])])).toBe(true);
    expect(programmeDate([jour('2026-07-10', ['Batur']), jour(null, ['Ubud'])])).toBe(false);
    expect(programmeDate([])).toBe(false);
  });

  it('traduit chaque créneau en événement, avec sa note et son budget', () => {
    const evenements = evenementsDuProgramme([jour('2026-07-10', ['Batur', 'Ubud'])]);
    expect(evenements).toHaveLength(2);
    expect(evenements[0]).toMatchObject({ titre: 'Batur', date: '2026-07-10', debut: '09:00' });
    expect(evenements[0]!.description).toContain('Du carnet d’activités.');
    expect(evenements[0]!.description).toContain('Budget indicatif');
    expect(evenements[1]).not.toHaveProperty('description');
  });

  it('donne un nom de fichier lisible et sûr', () => {
    expect(nomDuFichier('Bali entre potes !')).toBe('bali-entre-potes.ics');
    expect(nomDuFichier('Été à Séville')).toBe('ete-a-seville.ics');
    expect(nomDuFichier('///')).toBe('voyage.ics');
  });
});
