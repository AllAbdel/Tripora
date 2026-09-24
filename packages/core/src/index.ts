/**
 * @tripora/core — logique métier pure, sans réseau ni dépendance à l'environnement.
 * Importée à la fois par l'application web et par les Edge Functions Supabase,
 * pour que le calcul affiché et le calcul stocké soient rigoureusement les mêmes.
 */
export * from './match.js';
export * from './preferences.js';
export * from './money.js';
export * from './currency.js';
export * from './freshness.js';
export * from './geo.js';
export * from './types.js';
export * from './cost.js';
export * from './scoring.js';
export * from './schemas.js';
export * from './catalog/destinations.js';
export * from './catalog/discovered.js';
export * from './catalog/candidates.js';
export * from './catalog/origins.js';
// Le catalogue d'activités n'est pas réexporté ici : il pèse à lui seul plus
// que tout le moteur, et seuls deux écrans s'en servent. On l'importe par son
// propre chemin, `@tripora/core/activites`, là où on en a besoin — ce qui
// permet à l'application de ne le charger qu'à ce moment-là.
export * from './transport.js';
export * from './proposals.js';
export * from './itinerary.js';
export * from './places.js';
export * from './booking.js';
export * from './readiness.js';
export * from './settle.js';
export * from './catalog/climate.js';
export * from './catalog/pays.js';
export * from './weather.js';
export * from './replan.js';
export * from './fill.js';
export * from './calendrier.js';
export * from './reservations.js';
export * from './presentDuVoyage.js';
export * from './continents.js';
export * from './passeport.js';
export * from './sondages.js';
export * from './taches.js';
export * from './paiement.js';
export * from './confirmation.js';
export * from './distinction.js';
export * from './dates.js';
export * from './text.js';
export * from './duree.js';
export * from './links.js';
export * from './ai/draft.js';
export * from './ai/briefing.js';
export * from './apps.js';
export * from './palette.js';
export * from './icons.js';
export * from './packing.js';
