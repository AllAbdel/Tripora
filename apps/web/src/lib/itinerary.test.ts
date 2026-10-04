import { describe, expect, it } from 'vitest';
import { positionEntre, positionPourHeure } from './itinerary';

describe('positions fractionnaires', () => {
  it('se glisse exactement entre deux voisines', () => {
    expect(positionEntre(10, 20)).toBe(15);
    expect(positionEntre(15, 20)).toBe(17.5);
  });

  it('gère les extrémités de la journée', () => {
    expect(positionEntre(null, 10)).toBe(0);
    expect(positionEntre(40, null)).toBe(50);
    expect(positionEntre(null, null)).toBe(10);
  });

  it('ne renumérote jamais les voisines : une seule ligne change', () => {
    // Vingt insertions successives au même endroit restent ordonnées.
    let avant = 10;
    const apres = 20;
    for (let i = 0; i < 20; i += 1) {
      const nouvelle = positionEntre(avant, apres);
      expect(nouvelle).toBeGreaterThan(avant);
      expect(nouvelle).toBeLessThan(apres);
      avant = nouvelle;
    }
  });
});

describe('insertion à la bonne heure', () => {
  const journee = [
    { position: 10, startTime: '09:30' },
    { position: 20, startTime: '12:30' },
    { position: 30, startTime: '16:30' },
    { position: 40, startTime: '20:00' },
  ];

  it('glisse un lieu du matin avant celui de l’après-midi', () => {
    const position = positionPourHeure(journee, '10:30');
    expect(position).toBeGreaterThan(10);
    expect(position).toBeLessThan(20);
  });

  it('laisse en fin de journée ce qui vient après tout le reste', () => {
    expect(positionPourHeure(journee, '23:00')).toBeUndefined();
  });

  it('place en tête ce qui précède le premier créneau', () => {
    expect(positionPourHeure(journee, '07:00')).toBeLessThan(10);
  });

  it('n’impose rien quand aucune heure n’est donnée', () => {
    expect(positionPourHeure(journee, null)).toBeUndefined();
  });

  it('ignore les créneaux sans heure plutôt que de s’y comparer', () => {
    const melange = [
      { position: 10, startTime: null },
      { position: 20, startTime: '18:00' },
    ];
    const position = positionPourHeure(melange, '09:00');
    expect(position).toBeGreaterThan(10);
    expect(position).toBeLessThan(20);
  });
});
