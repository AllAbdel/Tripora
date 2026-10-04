import type { GeoPoint } from './types.js';

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Distance à vol d'oiseau en kilomètres. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Durée de trajet plausible en minutes, à défaut de données de transport réelles.
 * Volontairement pessimiste sur l'avion : on compte l'accès aéroport, l'attente
 * et le trajet vers le centre-ville, pas seulement le temps de vol.
 */
export function estimateTravelMinutes(distanceKm: number): number {
  if (distanceKm < 60) return Math.round(distanceKm * 1.2);
  if (distanceKm < 400) return Math.round(60 + distanceKm * 0.55); // train / voiture
  const flightMinutes = 60 + (distanceKm / 750) * 60;
  return Math.round(flightMinutes + 180); // aéroports, contrôles, transferts
}

/** Centre géographique d'un ensemble de points. Sert au regroupement par journée. */
export function centroid(points: readonly GeoPoint[]): GeoPoint {
  if (points.length === 0) throw new RangeError('Centroïde impossible : aucun point');
  let lat = 0;
  let lng = 0;
  for (const point of points) {
    lat += point.lat;
    lng += point.lng;
  }
  return { lat: lat / points.length, lng: lng / points.length };
}
