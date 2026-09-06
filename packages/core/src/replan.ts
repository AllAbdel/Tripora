import type { PreferenceAxis } from './preferences.js';
import { dayVerdict, skyFor, type DailyWeather } from './weather.js';

/**
 * Échanger deux journées quand la météo s'en mêle.
 *
 * Le cas est banal et agaçant : la randonnée tombe le jour de pluie, le musée
 * le jour de grand soleil. Personne ne le remarque avant d'y être. Le moteur
 * le voit — il connaît le programme de chaque journée et la prévision de
 * chaque date — et le dit.
 *
 * **Il ne le fait pas.** Aucune journée n'est déplacée toute seule : Tripora
 * propose, le groupe décide. Un itinéraire qui se réorganiserait pendant la
 * nuit serait impossible à faire confiance.
 *
 * Rien d'un modèle de langage ici : la prévision est mesurée, l'exposition se
 * déduit des envies servies, et la règle tient en six lignes. Une suggestion
 * doit pouvoir s'expliquer, sinon elle se subit.
 */

/**
 * Part de la journée qui se passe dehors, par envie servie.
 *
 * Grossier à dessein : la question n'est pas « combien de minutes sous le
 * ciel » mais « est-ce qu'un jour de pluie gâche cette journée-là ».
 */
const EXPOSITION: Readonly<Record<PreferenceAxis, number>> = {
  nature: 1,
  adventure: 0.9,
  offbeat: 0.55,
  relax: 0.4,
  shopping: 0.3,
  culture: 0.15,
  food: 0.1,
  nightlife: 0.1,
};

export interface DayPlan {
  dayIndex: number;
  /** Date locale à destination, si le voyage en a. */
  date?: string | undefined;
  /** Envies servies par les créneaux de la journée. */
  axes: readonly PreferenceAxis[];
}

export interface SwapSuggestion {
  /** Journée à déplacer : mauvais temps sur un programme en extérieur. */
  from: number;
  /** Journée qui l'accueillerait : beau temps sur un programme à l'abri. */
  to: number;
  /** Phrase prête à afficher, qui dit le pourquoi. */
  reason: string;
}

/** Entre 0 et 1. Une journée sans envie identifiée vaut 0 : rien à arbitrer. */
export function outdoorShare(axes: readonly PreferenceAxis[]): number {
  if (axes.length === 0) return 0;
  const total = axes.reduce((somme, axe) => somme + (EXPOSITION[axe] ?? 0.3), 0);
  return total / axes.length;
}

/** Au-delà : la journée se passe assez dehors pour que la pluie compte. */
const DEHORS = 0.5;
/** En deçà : la journée tient à l'abri, elle peut prendre le mauvais temps. */
const ABRI = 0.35;

/**
 * Les échanges qui vaudraient le coup, du plus utile au moins utile.
 *
 * On ne propose que des permutations franches — une journée nettement en
 * extérieur sous la pluie contre une journée nettement à l'abri au soleil.
 * Un demi-degré d'écart ne mérite pas de déranger un groupe qui a déjà décidé.
 */
export function suggestWeatherSwaps(
  days: readonly DayPlan[],
  forecast: readonly DailyWeather[],
  options: { max?: number } = {},
): SwapSuggestion[] {
  const meteo = new Map(forecast.map((jour) => [jour.date, jour]));

  const jours = days
    .filter((jour) => jour.date !== undefined && meteo.has(jour.date))
    .map((jour) => ({
      plan: jour,
      ciel: meteo.get(jour.date!)!,
      dehors: outdoorShare(jour.axes),
    }));

  const gachees = jours
    .filter(({ ciel, dehors }) => dehors >= DEHORS && dayVerdict(ciel) !== 'dehors')
    .sort((a, b) => severite(b.ciel) - severite(a.ciel));

  const abritees = jours
    .filter(({ ciel, dehors }) => dehors <= ABRI && dayVerdict(ciel) === 'dehors')
    .sort((a, b) => a.dehors - b.dehors);

  const suggestions: SwapSuggestion[] = [];
  const pris = new Set<number>();

  for (const gachee of gachees) {
    if (suggestions.length >= (options.max ?? 2)) break;
    if (pris.has(gachee.plan.dayIndex)) continue;

    const accueil = abritees.find(
      (jour) => !pris.has(jour.plan.dayIndex) && jour.plan.dayIndex !== gachee.plan.dayIndex,
    );
    if (!accueil) break;

    pris.add(gachee.plan.dayIndex);
    pris.add(accueil.plan.dayIndex);
    suggestions.push({
      from: gachee.plan.dayIndex,
      to: accueil.plan.dayIndex,
      reason:
        `${nommer(gachee.plan)} se passe dehors et s’annonce à la ${temps(gachee.ciel)} ; ` +
        `${nommer(accueil.plan)} tient à l’abri et s’annonce au sec. Les échanger ?`,
    });
  }

  return suggestions;
}

/** À quel point la journée est compromise : sert à traiter le pire d'abord. */
function severite(jour: DailyWeather): number {
  const ciel = skyFor(jour.code);
  if (ciel === 'orage') return 100;
  if (ciel === 'neige') return 90;
  return Math.min(80, jour.rainMm * 6 + Math.max(0, 12 - jour.maxC) * 2 + jour.windKmh / 3);
}

function temps(jour: DailyWeather): string {
  const ciel = skyFor(jour.code);
  if (ciel === 'orage') return 'tempête';
  if (ciel === 'neige') return 'neige';
  if (ciel === 'pluie') return 'pluie';
  return 'grisaille';
}

/** « Mercredi », ou « le jour 3 » quand le voyage n'a pas de dates. */
function nommer(jour: DayPlan): string {
  if (!jour.date) return `Le jour ${jour.dayIndex}`;
  const quand = new Date(`${jour.date}T00:00:00Z`);
  if (Number.isNaN(quand.getTime())) return `Le jour ${jour.dayIndex}`;
  const nom = quand.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'UTC' });
  return nom.charAt(0).toUpperCase() + nom.slice(1);
}
