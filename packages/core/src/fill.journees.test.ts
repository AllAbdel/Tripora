import { describe, expect, it } from 'vitest';
import { buildItinerary } from './itinerary.js';
import {
  accorderAuCreneau,
  fillItinerary,
  HEURES_PAR_JOUR,
  momentCompatible,
  momentDeLHeure,
  type SlotToFill,
} from './fill.js';
import { findDestination } from './catalog/destinations.js';
import { poisDeLaDestination } from './catalog/activites.js';
import type { MemberPreference, TripConstraints } from './types.js';
import { normalizeWeights } from './preferences.js';
import type { Poi } from './places.js';

/**
 * La simulation qui a tout déclenché : trois personnes, dix jours à Bali, au
 * départ de Paris. Le moteur bâtit le squelette, le carnet d'activités le
 * remplit, et on vérifie que le résultat ressemble à un vrai séjour.
 */
const BALI = findDestination('bali')!;

const CONTRAINTES: TripConstraints = {
  participants: 3,
  origin: { name: 'Paris-Orly', lat: 48.7233, lng: 2.3794, iata: ['ORY', 'PAR'] },
  durationDays: 10,
  dateMode: 'month',
  month: 7,
  budgetPerPersonCents: 180_000,
  comfortLevel: 'mid',
} as TripConstraints;

const MEMBRES: MemberPreference[] = [
  { userId: 'a', weights: normalizeWeights({ nature: 1, adventure: 0.66, relax: 0.33 }), budgetMaxCents: null },
  { userId: 'b', weights: normalizeWeights({ culture: 1, food: 0.66, nature: 0.33 }), budgetMaxCents: null },
  { userId: 'c', weights: normalizeWeights({ relax: 1, nightlife: 0.66, food: 0.66 }), budgetMaxCents: null },
];

function creneauxDuSejour(): SlotToFill[] {
  const plan = buildItinerary({ destination: BALI, constraints: CONTRAINTES, members: MEMBRES });
  return plan.days.flatMap((jour) =>
    jour.slots
      .filter((creneau) => creneau.kind === 'activity' && creneau.axis)
      .map((creneau) => ({
        dayIndex: jour.dayIndex,
        position: creneau.position,
        axis: creneau.axis!,
        startTime: creneau.startTime,
      })),
  );
}

describe('composer les journées à partir des activités', () => {
  const lieux = poisDeLaDestination('bali');
  const remplis = fillItinerary({ slots: creneauxDuSejour(), places: lieux });

  it('remplit vraiment un séjour de dix jours à Bali', () => {
    // Le point de départ de toute l'affaire : dix fois « Musées et monuments ».
    expect(remplis.length).toBeGreaterThanOrEqual(6);
    for (const rempli of remplis) {
      expect(rempli.poi.id.startsWith('activite:bali/'), rempli.poi.id).toBe(true);
    }
  });

  it('ne pose jamais une activité du soir le matin, ni l’inverse', () => {
    // Le kecak d'Uluwatu se joue au coucher du soleil. À neuf heures, il n'y
    // a personne sur la falaise.
    for (const rempli of remplis) {
      const heure = rempli.heureConseillee ?? rempli.startTime;
      const moment = momentDeLHeure(heure);
      if (rempli.poi.moment === 'soir') expect(moment, rempli.poi.name).not.toBe('matin');
      if (rempli.poi.moment === 'matin') expect(moment, rempli.poi.name).toBe('matin');
      if (rempli.poi.moment === 'journee') expect(heure, rempli.poi.name).toBe('08:00');
    }
  });

  it('place les activités du coucher du soleil, alors qu’aucun créneau n’est au soir', () => {
    // Le squelette ne connaît que 9 h 30 et 14 h 30. Sans le décalage à
    // 17 h 30, Tanah Lot et le kecak n'auraient jamais trouvé de place.
    const soirees = remplis.filter((rempli) => rempli.poi.moment === 'soir');
    expect(soirees.length).toBeGreaterThan(0);
    for (const soiree of soirees) {
      expect(soiree.heureConseillee ?? soiree.startTime, soiree.poi.name).toMatch(/^(17|18|19|2\d):/u);
    }
  });

  it('résiste à des envies incomplètes', () => {
    // Une envie absente de l'objet donnait NaN, et sept journées sur dix
    // restaient vides sans que rien ne le signale.
    const plan = buildItinerary({
      destination: BALI,
      constraints: CONTRAINTES,
      members: [{ userId: 'x', weights: { nature: 1 } as never, budgetMaxCents: null }],
    });
    const creneaux = plan.days.flatMap((jour) => jour.slots.filter((c) => c.kind === 'activity'));
    expect(creneaux.length).toBeGreaterThanOrEqual(15);
  });

  it('laisse une excursion à la journée seule dans sa journée', () => {
    const parJour = new Map<number, typeof remplis>();
    for (const rempli of remplis) {
      parJour.set(rempli.dayIndex, [...(parJour.get(rempli.dayIndex) ?? []), rempli]);
    }
    for (const [jour, liste] of parJour) {
      if (liste.some((rempli) => rempli.poi.moment === 'journee')) {
        expect(liste, `jour ${jour}`).toHaveLength(1);
      }
    }
  });

  it('ne dépasse pas ce qu’une journée tient', () => {
    const heuresParJour = new Map<number, { heures: number; nombre: number }>();
    for (const rempli of remplis) {
      const actuel = heuresParJour.get(rempli.dayIndex) ?? { heures: 0, nombre: 0 };
      heuresParJour.set(rempli.dayIndex, {
        heures: actuel.heures + (rempli.poi.dureeHeures ?? 0),
        nombre: actuel.nombre + 1,
      });
    }
    for (const [jour, { heures, nombre }] of heuresParJour) {
      // Une seule activité longue peut dépasser : elle occupe alors la journée.
      if (nombre > 1) {
        expect(heures, `jour ${jour} : ${heures} h`).toBeLessThanOrEqual(HEURES_PAR_JOUR);
      }
    }
  });

  it('ne propose pas deux fois la même activité', () => {
    const vues = remplis.map((rempli) => rempli.poi.id);
    expect(new Set(vues).size).toBe(vues.length);
  });

  it('reprend le prix de l’activité dans le budget du créneau', () => {
    for (const rempli of remplis) {
      expect(rempli.costCents, rempli.poi.name).toBe(rempli.poi.prixCents);
    }
  });

  it('dit d’où vient le lieu, sans prétendre qu’il sort de Wikipédia', () => {
    for (const rempli of remplis) {
      expect(rempli.reason, rempli.poi.name).toContain('carnet d’activités');
      expect(rempli.reason, rempli.poi.name).not.toContain('Wikipédia');
      expect(rempli.reason, rempli.poi.name).not.toContain('OpenStreetMap');
    }
  });
});

describe('les règles, une par une', () => {
  const lieu = (surcharge: Partial<Poi>): Poi => ({
    id: 'activite:x/a',
    name: 'Lieu',
    lat: -8.5,
    lng: 115.2,
    category: 'monument',
    axis: 'culture',
    label: 'Monument',
    ...surcharge,
  });

  it('lit le moment d’une heure', () => {
    expect(momentDeLHeure('09:00')).toBe('matin');
    expect(momentDeLHeure('11:59')).toBe('matin');
    expect(momentDeLHeure('14:30')).toBe('apres-midi');
    expect(momentDeLHeure('18:00')).toBe('soir');
    expect(momentDeLHeure('21:15')).toBe('soir');
    expect(momentDeLHeure(null)).toBeUndefined();
    expect(momentDeLHeure('bientôt')).toBeUndefined();
  });

  it('laisse passer ce dont on ne sait rien', () => {
    // Un musée relevé sur OSM n'a pas d'horaire : il ne doit pas être écarté
    // pour autant.
    expect(momentCompatible(undefined, 'soir')).toBe(true);
    expect(momentCompatible('soir', undefined)).toBe(true);
  });

  it('ne fait partir une excursion à la journée que le matin, et tôt', () => {
    expect(accorderAuCreneau('journee', 'matin')).toEqual({ heure: '08:00' });
    expect(momentCompatible('journee', 'apres-midi')).toBe(false);
    expect(momentCompatible('journee', 'soir')).toBe(false);
  });

  it('décale une activité du soir sur le créneau de l’après-midi', () => {
    expect(accorderAuCreneau('soir', 'apres-midi')).toEqual({ heure: '17:30' });
    expect(accorderAuCreneau('soir', 'soir')).toEqual({});
    // Jamais le matin : on ne décale pas un coucher de soleil de dix heures.
    expect(accorderAuCreneau('soir', 'matin')).toBeNull();
    expect(accorderAuCreneau('matin', 'apres-midi')).toBeNull();
  });

  it('préfère un trou à une activité du mauvais moment', () => {
    // Un seul lieu « culture », et il se fait le soir : le créneau du matin
    // reste vide. C'est la règle du moteur depuis le début — un trou est plus
    // honnête qu'un remplissage à côté de la plaque.
    const remplis = fillItinerary({
      slots: [{ dayIndex: 1, position: 1, axis: 'culture', startTime: '09:30' }],
      places: [lieu({ moment: 'soir' })],
    });
    expect(remplis).toEqual([]);
  });

  it('n’ajoute rien après une excursion à la journée', () => {
    const remplis = fillItinerary({
      slots: [
        { dayIndex: 1, position: 1, axis: 'nature', startTime: '08:00' },
        { dayIndex: 1, position: 2, axis: 'culture', startTime: '15:00' },
      ],
      places: [
        lieu({ id: 'activite:x/ile', axis: 'nature', moment: 'journee', dureeHeures: 11 }),
        lieu({ id: 'activite:x/temple', axis: 'culture', moment: 'apres-midi', dureeHeures: 2 }),
      ],
    });
    expect(remplis.map((rempli) => rempli.poi.id)).toEqual(['activite:x/ile']);
  });

  it('n’empile pas une activité longue sur une journée déjà chargée', () => {
    const remplis = fillItinerary({
      slots: [
        { dayIndex: 1, position: 1, axis: 'culture', startTime: '09:00' },
        { dayIndex: 1, position: 2, axis: 'adventure', startTime: '14:00' },
      ],
      places: [
        lieu({ id: 'activite:x/musee', moment: 'matin', dureeHeures: 4 }),
        lieu({ id: 'activite:x/rando', axis: 'adventure', moment: 'apres-midi', dureeHeures: 7 }),
      ],
    });
    // 4 h + 7 h dépasseraient les dix heures d'une journée.
    expect(remplis.map((rempli) => rempli.poi.id)).toEqual(['activite:x/musee']);
  });
});
