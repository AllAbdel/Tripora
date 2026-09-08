import { findDestination, type DestinationScore, type Place, type Poi } from '@tripora/core';
import type { MapMarker } from '@/components/TripMap';

/**
 * Repères à poser sur la carte d'un voyage.
 *
 * Extrait de l'écran pour être testable : c'est une transformation pure, et
 * c'est là que se joue la seule vraie règle d'affichage — une fois la
 * destination arrêtée, la carte ne montre plus qu'elle. Continuer à afficher
 * les recalées brouillerait le message : le débat est clos.
 *
 * C'est aussi à ce moment-là que les lieux apparaissent. Avant la décision ils
 * n'auraient aucun sens — on compare des villes, pas des musées ; après, ils
 * sont tout ce qui compte.
 */
export function buildTripMarkers({
  origin,
  scores,
  lockedDestinationId,
  places = [],
  pins = [],
  onSelect,
}: {
  origin: Place;
  scores: readonly DestinationScore[];
  lockedDestinationId: string | null;
  /** Lieux de la destination retenue. Ignorés tant que rien n'est tranché. */
  places?: readonly Poi[];
  /**
   * Endroits épinglés par le groupe dans la discussion.
   *
   * Contrairement aux lieux, ils s'affichent **à tout moment** : ils viennent
   * de la conversation, qui commence bien avant que la destination soit
   * tranchée, et les cacher jusque-là reviendrait à perdre ce que les gens ont
   * pris la peine de retenir. Ceux dont on ignore les coordonnées ne sont pas
   * placés : une épingle au mauvais endroit est pire qu'une épingle absente.
   */
  pins?: readonly { id: string; label: string; lat: number | null; lng: number | null }[];
  onSelect?: (destinationId: string) => void;
}): MapMarker[] {
  const markers: MapMarker[] = [
    {
      id: 'origine',
      point: origin,
      label: `Départ de ${origin.name}`,
      glyphe: 'depart',
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
      ...(lockedDestinationId
        ? { glyphe: 'etoile' as const }
        : { badge: String(index + 1) }),
      kind: lockedDestinationId === destination.id ? 'chosen' : 'destination',
      ...(onSelect ? { onSelect: () => onSelect(destination.id) } : {}),
    });
  }

  if (lockedDestinationId) {
    for (const lieu of places) {
      markers.push({
        id: lieu.id,
        point: lieu,
        label: `${lieu.name} — ${lieu.label}`,
        kind: 'place',
      });
    }
  }

  for (const epingle of pins) {
    if (epingle.lat === null || epingle.lng === null) continue;
    markers.push({
      id: `epingle:${epingle.id}`,
      point: { lat: epingle.lat, lng: epingle.lng },
      label: epingle.label,
      glyphe: 'epingle',
      kind: 'pin',
    });
  }

  return markers;
}
