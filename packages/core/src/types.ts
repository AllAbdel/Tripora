import type { PreferenceAxis, PreferenceWeights } from './preferences.js';
import type { PriceSource } from './freshness.js';

export type ComfortLevel = 'budget' | 'mid' | 'comfort';
export type BudgetMode = 'cheapest' | 'max_per_person' | 'comfortable';
export type DateMode = 'exact' | 'window' | 'month' | 'weekend';
export type GroupType = 'solo' | 'couple' | 'friends' | 'family' | 'custom';
export type TripStatus = 'draft' | 'proposing' | 'voting' | 'planned' | 'ongoing' | 'done';
export type VoteValue = 'like' | 'dislike' | 'favorite';
export type TransportMode = 'plane' | 'train' | 'bus' | 'car' | 'ferry';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Place extends GeoPoint {
  name: string;
  country?: string;
  /** Codes IATA des aéroports desservants, du plus pratique au moins pratique. */
  iata?: string[];
}

/** Une destination du catalogue local (aucun appel réseau pour la lire). */
export interface Destination {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  iata: string[];
  /** Affinité de la destination avec chaque axe, entre 0 et 1. */
  tags: PreferenceWeights;
  /**
   * Indice de cherté sur place, 1 = moyenne européenne.
   * 0.5 ≈ très bon marché (Balkans), 2 ≈ très cher (Suisse, Islande).
   */
  costIndex: number;
  /** Densité d'activités disponibles, entre 0 et 1. Sert à juger « y a-t-il de quoi faire ». */
  poiRichness: number;
  /** Mois les plus agréables (1 = janvier). Repli quand on n'a pas de données climatiques. */
  bestMonths: number[];
  timezone?: string;
  imageUrl?: string;
  wikidataId?: string;
}

/** Normales climatiques d'un mois donné, issues d'Open-Meteo. Jamais de l'IA. */
export interface MonthlyClimate {
  month: number;
  avgHighC: number;
  avgLowC: number;
  rainyDays: number;
}

export interface MemberPreference {
  userId: string;
  /** Nom d'affichage : reste côté client, n'est jamais transmis à un fournisseur d'IA. */
  displayName?: string;
  weights: PreferenceWeights;
  /** Budget maximal de cette personne, par personne, en centimes. */
  budgetMaxCents: number | null;
  /** Axes explicitement rejetés (« pas de musées »). */
  avoid?: PreferenceAxis[];
  mustHave?: string[];
}

export interface TripConstraints {
  participants: number;
  origin: Place;
  durationDays: number;
  dateMode: DateMode;
  startDate?: string;
  endDate?: string;
  windowStart?: string;
  windowEnd?: string;
  /** Mois visé quand `dateMode === 'month'` (1 = janvier). */
  month?: number;
  budgetMode: BudgetMode;
  budgetPerPersonCents: number | null;
  comfortLevel: ComfortLevel;
  groupType: GroupType;
}

/** Ventilation d'un coût de voyage, par personne, en centimes. */
export interface CostBreakdown {
  transportCents: number;
  accommodationCents: number;
  foodCents: number;
  activitiesCents: number;
  localTransportCents: number;
  miscCents: number;
  totalCents: number;
  /** Fiabilité globale : aussi bonne que le plus faible des postes. */
  source: PriceSource;
  transportSource: PriceSource;
  transportFetchedAt?: string;
  transportProvider?: string;
}

export interface ScoreFactor {
  key: 'price' | 'preferences' | 'climate' | 'travel' | 'activities' | 'equity';
  label: string;
  /** Note du facteur, de 0 à 100. */
  score: number;
  /** Poids du facteur dans la note finale, de 0 à 1. */
  weight: number;
  /** Phrase prête à afficher, en français. Construite par le code, pas par l'IA. */
  reason: string;
}

export interface DestinationScore {
  destinationId: string;
  /** Note finale de 0 à 100. */
  total: number;
  factors: ScoreFactor[];
  cost: CostBreakdown;
  /** Satisfaction estimée de chaque participant, de 0 à 1. */
  memberSatisfaction: { userId: string; value: number }[];
  /** Résumé factuel généré par le code. L'IA peut le reformuler, jamais le contredire. */
  summary: string;
}
