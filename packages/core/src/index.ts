/**
 * @tripora/core — logique métier pure, sans réseau ni dépendance à l'environnement.
 * Importée à la fois par l'application web et par les Edge Functions Supabase,
 * pour que le calcul affiché et le calcul stocké soient rigoureusement les mêmes.
 */
export * from './preferences.js';
export * from './money.js';
export * from './freshness.js';
export * from './geo.js';
export * from './types.js';
export * from './cost.js';
export * from './scoring.js';
export * from './schemas.js';
export * from './catalog/destinations.js';
export * from './catalog/candidates.js';
export * from './catalog/origins.js';
export * from './transport.js';
export * from './proposals.js';
export * from './itinerary.js';
export * from './settle.js';
export * from './catalog/climate.js';
export * from './dates.js';
export * from './text.js';
export * from './ai/draft.js';
