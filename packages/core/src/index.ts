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
