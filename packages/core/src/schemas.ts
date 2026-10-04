import { z } from 'zod';
import { PREFERENCE_AXES } from './preferences.js';

/**
 * Schémas partagés par l'application, les Edge Functions et l'IA.
 * Une sortie de modèle qui ne passe pas ces schémas est rejetée : c'est la
 * barrière qui empêche une hallucination d'entrer dans la base de données.
 */

const unitInterval = z.number().min(0).max(1);

export const preferenceAxisSchema = z.enum(PREFERENCE_AXES);

export const preferenceWeightsSchema = z.object(
  Object.fromEntries(PREFERENCE_AXES.map((axis) => [axis, unitInterval])) as Record<
    (typeof PREFERENCE_AXES)[number],
    typeof unitInterval
  >,
);

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const placeSchema = geoPointSchema.extend({
  name: z.string().min(1).max(120),
  country: z.string().max(80).optional(),
  iata: z.array(z.string().regex(/^[A-Z]{3}$/)).max(6).optional(),
});

export const comfortLevelSchema = z.enum(['budget', 'mid', 'comfort']);
export const budgetModeSchema = z.enum(['cheapest', 'max_per_person', 'comfortable']);
export const dateModeSchema = z.enum(['exact', 'window', 'month', 'weekend']);
export const groupTypeSchema = z.enum(['solo', 'couple', 'friends', 'family', 'custom']);
export const voteValueSchema = z.enum(['like', 'dislike', 'favorite']);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');

export const tripConstraintsSchema = z
  .object({
    participants: z.number().int().min(1).max(30),
    origin: placeSchema,
    durationDays: z.number().int().min(1).max(90),
    dateMode: dateModeSchema,
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    windowStart: isoDate.optional(),
    windowEnd: isoDate.optional(),
    month: z.number().int().min(1).max(12).optional(),
    budgetMode: budgetModeSchema,
    budgetPerPersonCents: z.number().int().min(0).max(100_000_00).nullable(),
    comfortLevel: comfortLevelSchema,
    groupType: groupTypeSchema,
  })
  .refine((value) => value.dateMode !== 'exact' || Boolean(value.startDate), {
    message: 'Des dates exactes demandent une date de départ',
    path: ['startDate'],
  })
  .refine((value) => value.dateMode !== 'window' || Boolean(value.windowStart && value.windowEnd), {
    message: 'Une fenêtre demande une date de début et de fin',
    path: ['windowStart'],
  })
  .refine((value) => value.dateMode !== 'month' || value.month !== undefined, {
    message: 'Le mode « un mois » demande un mois',
    path: ['month'],
  });

export const memberPreferenceSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().max(60).optional(),
  weights: preferenceWeightsSchema,
  budgetMaxCents: z.number().int().min(0).max(100_000_00).nullable(),
  avoid: z.array(preferenceAxisSchema).max(8).optional(),
  mustHave: z.array(z.string().max(60)).max(10).optional(),
});

/**
 * Sortie attendue de l'outil IA `parseTripRequest` : une phrase libre devient
 * un jeu de contraintes structuré. Tout champ non compris reste absent plutôt
 * que d'être inventé.
 */
export const parsedTripRequestSchema = z.object({
  participants: z.number().int().min(1).max(30).nullable(),
  originName: z.string().max(120).nullable(),
  destinationHint: z.string().max(160).nullable(),
  durationDays: z.number().int().min(1).max(90).nullable(),
  month: z.number().int().min(1).max(12).nullable(),
  budgetPerPersonCents: z.number().int().min(0).max(100_000_00).nullable(),
  budgetMode: budgetModeSchema.nullable(),
  comfortLevel: comfortLevelSchema.nullable(),
  preferences: preferenceWeightsSchema.partial(),
  avoid: z.array(z.string().max(60)).max(10),
  /** Ce que le modèle n'a pas su interpréter : sert à reposer la question à l'utilisateur. */
  unclear: z.array(z.string().max(120)).max(5),
});

export type ParsedTripRequest = z.infer<typeof parsedTripRequestSchema>;

export const expenseInputSchema = z.object({
  tripId: z.string().uuid(),
  paidBy: z.string().uuid(),
  amountCents: z.number().int().min(1).max(1_000_000_00),
  currency: z.string().regex(/^[A-Z]{3}$/),
  category: z.enum(['transport', 'accommodation', 'food', 'activities', 'shopping', 'other']),
  label: z.string().min(1).max(120),
  date: isoDate,
  sharedWith: z.array(z.string().uuid()).min(1).max(30),
});

export const inviteCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{8}$/, 'Un code d’invitation fait 8 caractères');
