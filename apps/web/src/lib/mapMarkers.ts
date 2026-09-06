import { findDestination, type DestinationScore, type Place } from '@tripora/core';
import type { MapMarker } from '@/components/TripMap';

/**
 * Repères à poser sur la carte d'un voyage.
 *
 * Extrait de l'écran pour être testable : c'est une transformation pure, et
 * c'est là que se joue la seule vraie règle d'affichage — une fois la
 * destination arrêtée, la carte ne montre plus qu'elle. Continuer à afficher
 * les recalées brouillerait le message : le débat est clos.
 */
export function buildTripMarkers({
  origin,
  scores,
  lockedDestinationId,
  onSelect,
}: {
  origin: Place;
  scores: readonly DestinationScore[];
  lockedDestinationId: string | null;
  onSelect?: (destinationId: string) => void;
}): MapMarker[] {
  const markers: MapMarker[] = [
    {
      id: 'origine',
      point: origin,
      label: `Départ de ${origin.name}`,
      badge: '↑',
      kind: 'origin',
    },
  ];

  const affichees = lockedDestinationId
    ? scores.filter((score) => score.destinationId === lockedDestinationId)
    : scores;

  for (const [index, score] of affichees.entries()) {
    const destination = findDestination(score.destinationId);
    if (!destination) continue;
    markers.push({
      id: destination.id,
      point: destination,
      label: `${destination.name} — ${score.total}/100`,
      badge: lockedDestinationId ? '★' : String(index + 1),
      kind: lockedDestinationId === destination.id ? 'chosen' : 'destination',
      ...(onSelect ? { onSelect: () => onSelect(destination.id) } : {}),
    });
  }

  return markers;
}
