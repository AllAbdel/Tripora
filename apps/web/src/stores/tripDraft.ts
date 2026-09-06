import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  normalizeWeights,
  type BudgetMode,
  type ComfortLevel,
  type DateMode,
  type GroupType,
  type MemberPreference,
  type Place,
  type PreferenceAxis,
  type PreferenceWeights,
  type TripConstraints,
} from '@tripora/core';

export const STEPS = ['groupe', 'depart', 'destination', 'dates', 'budget', 'envies'] as const;
export type StepId = (typeof STEPS)[number];

export interface TripDraft {
  title: string;
  groupType: GroupType;
  participants: number;
  origin: Place | null;
  destinationMode: 'fixed' | 'suggest';
  destinationIds: string[];
  dateMode: DateMode;
  startDate: string | null;
  endDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  month: number | null;
  durationDays: number;
  budgetMode: BudgetMode;
  budgetPerPersonCents: number | null;
  comfortLevel: ComfortLevel;
  /** Seuls les axes auxquels la personne a répondu figurent ici :
   *  « pas encore répondu » et « non merci » ne veulent pas dire la même chose. */
  weights: Partial<PreferenceWeights>;
  avoid: PreferenceAxis[];
}

interface DraftStore extends TripDraft {
  patch: (values: Partial<TripDraft>) => void;
  setWeight: (axis: PreferenceAxis, value: number) => void;
  toggleAvoid: (axis: PreferenceAxis) => void;
  toggleDestination: (id: string) => void;
  reset: () => void;
}

const EMPTY: TripDraft = {
  title: '',
  groupType: 'friends',
  participants: 4,
  origin: null,
  destinationMode: 'suggest',
  destinationIds: [],
  dateMode: 'month',
  startDate: null,
  endDate: null,
  windowStart: null,
  windowEnd: null,
  month: null,
  durationDays: 4,
  budgetMode: 'max_per_person',
  budgetPerPersonCents: null,
  comfortLevel: 'budget',
  weights: {},
  avoid: [],
};

/**
 * Brouillon du voyage en cours de création.
 *
 * Conservé sur l'appareil : répondre à six écrans puis tout perdre parce qu'un
 * appel est arrivé est la meilleure façon de faire abandonner quelqu'un.
 */
export const useTripDraft = create<DraftStore>()(
  persist(
    (set) => ({
      ...EMPTY,
      patch: (values) => set(values),
      setWeight: (axis, value) =>
        set((state) => ({ weights: { ...state.weights, [axis]: value } })),
      toggleAvoid: (axis) =>
        set((state) => ({
          avoid: state.avoid.includes(axis)
            ? state.avoid.filter((entry) => entry !== axis)
            : [...state.avoid, axis],
        })),
      toggleDestination: (id) =>
        set((state) => ({
          destinationIds: state.destinationIds.includes(id)
            ? state.destinationIds.filter((entry) => entry !== id)
            : [...state.destinationIds, id],
        })),
      reset: () => set({ ...EMPTY, weights: {} }),
    }),
    { name: 'tripora.trip-draft', version: 1 },
  ),
);

/** Une étape est franchissable seulement si elle a reçu une vraie réponse. */
export function isStepComplete(step: StepId, draft: TripDraft): boolean {
  switch (step) {
    case 'groupe':
      return draft.participants >= 1;
    case 'depart':
      return draft.origin !== null;
    case 'destination':
      return draft.destinationMode === 'suggest' || draft.destinationIds.length > 0;
    case 'dates':
      if (draft.dateMode === 'exact') return Boolean(draft.startDate && draft.endDate);
      if (draft.dateMode === 'window') return Boolean(draft.windowStart && draft.windowEnd);
      if (draft.dateMode === 'month') return draft.month !== null;
      return true;
    case 'budget':
      return draft.budgetMode === 'cheapest' || draft.budgetPerPersonCents !== null;
    case 'envies':
      // Au moins une envie : sans rien, il n'y a rien à optimiser.
      return Object.values(draft.weights).some((weight) => (weight ?? 0) > 0);
  }
}

/** Traduit le brouillon en contraintes exploitables par le moteur. */
export function toConstraints(draft: TripDraft): TripConstraints | null {
  if (!draft.origin) return null;
  return {
    participants: draft.participants,
    origin: draft.origin,
    durationDays: draft.durationDays,
    dateMode: draft.dateMode,
    ...(draft.startDate ? { startDate: draft.startDate } : {}),
    ...(draft.endDate ? { endDate: draft.endDate } : {}),
    ...(draft.windowStart ? { windowStart: draft.windowStart } : {}),
    ...(draft.windowEnd ? { windowEnd: draft.windowEnd } : {}),
    ...(draft.month !== null ? { month: draft.month } : {}),
    budgetMode: draft.budgetMode,
    budgetPerPersonCents: draft.budgetPerPersonCents,
    comfortLevel: draft.comfortLevel,
    groupType: draft.groupType,
  };
}

/**
 * Les envies du créateur sont ses préférences de membre, pas celles du groupe.
 * Les axes sans réponse sont complétés à zéro : le moteur a besoin des huit.
 */
export function toMemberPreference(draft: TripDraft, userId: string): MemberPreference {
  return {
    userId,
    weights: normalizeWeights(draft.weights),
    budgetMaxCents: draft.budgetPerPersonCents,
    avoid: draft.avoid,
  };
}

/** Titre proposé automatiquement, modifiable : personne n'aime nommer un brouillon. */
export function suggestTitle(draft: TripDraft, destinationName?: string): string {
  if (draft.title.trim()) return draft.title.trim();
  if (destinationName) return `${destinationName} à ${draft.participants}`;
  const quand = draft.month ? ` en ${MONTHS[draft.month - 1]}` : '';
  return `${draft.durationDays} jours${quand}`;
}

export const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const;
