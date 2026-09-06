/**
 * Les 8 axes de préférences de Tripora.
 * Cette liste est la référence unique : base de données, UI, IA et scoring l'utilisent tous.
 */
export const PREFERENCE_AXES = [
  'culture',
  'nature',
  'food',
  'nightlife',
  'relax',
  'adventure',
  'shopping',
  'offbeat',
] as const;

export type PreferenceAxis = (typeof PREFERENCE_AXES)[number];

/** Poids d'un axe, entre 0 (aucun intérêt) et 1 (indispensable). */
export type PreferenceWeights = Record<PreferenceAxis, number>;

/**
 * Niveaux proposés dans l'interface. On évite les curseurs en pourcentage,
 * pénibles au pouce sur mobile, au profit de 4 paliers explicites.
 */
export const PREFERENCE_LEVELS = [
  { value: 0, label: 'Non merci' },
  { value: 1 / 3, label: 'Un peu' },
  { value: 2 / 3, label: 'Beaucoup' },
  { value: 1, label: 'Essentiel' },
] as const;

export const AXIS_LABELS_FR: Record<PreferenceAxis, string> = {
  culture: 'Culture et histoire',
  nature: 'Nature et paysages',
  food: 'Gastronomie',
  nightlife: 'Fête et vie nocturne',
  relax: 'Détente',
  adventure: 'Aventure et sport',
  shopping: 'Shopping',
  offbeat: 'Insolite',
};

export const AXIS_EMOJI: Record<PreferenceAxis, string> = {
  culture: '🏛️',
  nature: '🏔️',
  food: '🍽️',
  nightlife: '🎉',
  relax: '🌴',
  adventure: '🧗',
  shopping: '🛍️',
  offbeat: '🎭',
};

/** Objet de poids entièrement à zéro (point de départ neutre). */
export function emptyWeights(): PreferenceWeights {
  return Object.fromEntries(PREFERENCE_AXES.map((a) => [a, 0])) as PreferenceWeights;
}

/** Ramène chaque poids dans [0, 1] et complète les axes manquants par 0. */
export function normalizeWeights(input: Partial<PreferenceWeights>): PreferenceWeights {
  const out = emptyWeights();
  for (const axis of PREFERENCE_AXES) {
    const raw = input[axis];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[axis] = Math.min(1, Math.max(0, raw));
    }
  }
  return out;
}

/**
 * Convertit un poids libre vers le palier d'interface le plus proche.
 * Utile pour réafficher des poids produits par l'IA ou importés.
 */
export function toNearestLevel(weight: number): number {
  let best: number = PREFERENCE_LEVELS[0].value;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const level of PREFERENCE_LEVELS) {
    const gap = Math.abs(level.value - weight);
    if (gap < bestGap) {
      bestGap = gap;
      best = level.value;
    }
  }
  return best;
}

/** Les axes qui comptent vraiment pour quelqu'un, du plus fort au plus faible. */
export function topAxes(weights: PreferenceWeights, count = 3, threshold = 0.3): PreferenceAxis[] {
  return PREFERENCE_AXES.filter((axis) => weights[axis] >= threshold)
    .sort((a, b) => weights[b] - weights[a])
    .slice(0, count);
}
