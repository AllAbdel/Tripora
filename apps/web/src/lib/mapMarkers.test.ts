import { describe, expect, it, vi } from 'vitest';
import type { DestinationScore } from '@tripora/core';
import { buildTripMarkers } from './mapMarkers';
import type { Poi } from '@tripora/core';

const MUSEE: Poi = {
  id: 'osm:way/1',
  name: 'Musée Calouste-Gulbenkian',
  lat: 38.737,
  lng: -9.153,
  category: 'musee',
  axis: 'culture',
  label: 'Musée',
};

const PARIS = { name: 'Paris', lat: 48.8566, lng: 2.3522 };

function score(destinationId: string, total: number): DestinationScore {
  return {
    destinationId,
    total,
    factors: [],
    memberSatisfaction: [],
    summary: '',
    cost: {
      transportCents: 0,
      accommodationCents: 0,
      foodCents: 0,
      activitiesCents: 0,
      localTransportCents: 0,
      miscCents: 0,
      totalCents: 0,
      source: 'estimated',
      transportSource: 'estimated',
    },
  };
}

const TROIS = [score('rome', 95), score('budapest', 90), score('lisbonne', 88)];

describe('repères de la carte', () => {
  it('place toujours le point de départ en premier', () => {
    const markers = buildTripMarkers({
      origin: PARIS,
      scores: TROIS,
      lockedDestinationId: null,
    });
    expect(markers[0]?.kind).toBe('origin');
    expect(markers[0]?.label).toBe('Départ de Paris');
    expect(markers).toHaveLength(4);
  });

  it('numérote les destinations dans l’ordre du classement', () => {
    const markers = buildTripMarkers({
      origin: PARIS,
      scores: TROIS,
      lockedDestinationId: null,
    });
    expect(markers.slice(1).map((m) => m.badge)).toEqual(['1', '2', '3']);
    expect(markers[1]?.label).toBe('Rome — 95/100');
  });

  it('ne montre plus que la destination retenue une fois le vote tranché', () => {
    const markers = buildTripMarkers({
      origin: PARIS,
      scores: TROIS,
      lockedDestinationId: 'budapest',
    });
    expect(markers).toHaveLength(2);
    expect(markers[1]?.id).toBe('budapest');
    expect(markers[1]?.kind).toBe('chosen');
    expect(markers[1]?.badge).toBe('★');
  });

  it('utilise les vraies coordonnées du catalogue', () => {
    const markers = buildTripMarkers({
      origin: PARIS,
      scores: [score('budapest', 90)],
      lockedDestinationId: null,
    });
    expect(markers[1]?.point.lat).toBeCloseTo(47.4979, 3);
    expect(markers[1]?.point.lng).toBeCloseTo(19.0402, 3);
  });

  it('ignore une destination absente du catalogue plutôt que de planter', () => {
    const markers = buildTripMarkers({
      origin: PARIS,
      scores: [score('atlantide', 99), score('rome', 90)],
      lockedDestinationId: null,
    });
    expect(markers).toHaveLength(2);
    expect(markers[1]?.id).toBe('rome');
  });

  it('rattache la sélection à la bonne destination', () => {
    const onSelect = vi.fn();
    const markers = buildTripMarkers({
      origin: PARIS,
      scores: TROIS,
      lockedDestinationId: null,
      onSelect,
    });
    markers[2]?.onSelect?.();
    expect(onSelect).toHaveBeenCalledWith('budapest');
  });

  it('ne pose les lieux qu’une fois la destination arrêtée', () => {
    // Avant la décision, un musée de Lisbonne au milieu de six villes
    // candidates ne veut rien dire : on compare des villes, pas des musées.
    const avant = buildTripMarkers({
      origin: PARIS,
      scores: TROIS,
      lockedDestinationId: null,
      places: [MUSEE],
    });
    expect(avant.some((repere) => repere.kind === 'place')).toBe(false);

    const apres = buildTripMarkers({
      origin: PARIS,
      scores: TROIS,
      lockedDestinationId: 'lisbonne',
      places: [MUSEE],
    });
    const lieu = apres.find((repere) => repere.kind === 'place');
    expect(lieu?.label).toBe('Musée Calouste-Gulbenkian — Musée');
    expect(lieu?.point).toMatchObject({ lat: 38.737, lng: -9.153 });
  });

  it('reste identique quand aucun lieu n’est fourni', () => {
    expect(
      buildTripMarkers({ origin: PARIS, scores: TROIS, lockedDestinationId: 'lisbonne' }),
    ).toEqual(
      buildTripMarkers({
        origin: PARIS,
        scores: TROIS,
        lockedDestinationId: 'lisbonne',
        places: [],
      }),
    );
  });
});
