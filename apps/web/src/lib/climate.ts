import { climateFromSeries, type Destination, type MonthlyClimate } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Les normales climatiques relevées, pour les villes qu'on s'apprête à noter.
 *
 * Le moteur embarque celles de cinquante-cinq villes, écrites dans son propre
 * code : elles fonctionnent hors ligne et ne coûtent aucun appel. Le catalogue
 * en compte cinq cents, et relever les autres à la main n'avait pas de sens —
 * ce sont des mesures. Elles vivent donc dans la base, remplies une fois par
 * la fonction `climate-normals` depuis les archives Open-Meteo.
 *
 * On ne charge que les candidates réellement étudiées, une vingtaine, en une
 * requête. Et une seule fois : une normale climatique ne bouge pas, d'où un
 * cache très long côté application.
 *
 * L'échec est silencieux et sans conséquence visible : sans ces chiffres, le
 * moteur retombe sur ses normales embarquées puis sur `bestMonths`. Le
 * classement reste calculable, il perd seulement en finesse sur un facteur qui
 * pèse un dixième de la note.
 */

/**
 * Les normales relevées, indexées par identifiant de ville.
 *
 * Un objet simple et non une `Map`, pour une raison qui a coûté un bug : le
 * cache de requêtes est **persisté en JSON** dans le navigateur, pour que les
 * voyages restent consultables hors ligne. Or `JSON.stringify(new Map())`
 * donne `{}` — la structure survit à l'aller et revient vide au retour, sans
 * la moindre erreur. Au rechargement suivant, `normales.size` valait
 * `undefined`, le test « pas de normales » ne se déclenchait plus, et le
 * moteur appelait `.get()` sur un objet qui n'en a pas.
 *
 * Règle qui en découle pour tout ce qui passe par une requête : **des données
 * que JSON sait écrire et relire à l'identique**, jamais de Map, de Set ni de
 * Date.
 */
export type NormalesParVille = Readonly<Record<string, readonly number[]>>;

const VIDE: NormalesParVille = {};

export async function chargerNormales(
  destinations: readonly Destination[],
): Promise<NormalesParVille> {
  // Inutile de demander celles qu'on connaît déjà par cœur.
  const inconnues = destinations.filter((ville) => !ville.discovered).map((ville) => ville.id);
  if (!supabase || inconnues.length === 0) return VIDE;

  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('id, climate')
      .in('id', inconnues)
      .not('climate', 'is', null);
    if (error) return VIDE;

    const parVille: Record<string, readonly number[]> = {};
    for (const ligne of data ?? []) {
      const serie = ligne.climate as unknown;
      // Trente-six nombres, ou rien : une série tronquée décalerait les mois.
      if (Array.isArray(serie) && serie.length === 36 && serie.every(estNombre)) {
        parVille[ligne.id as string] = serie;
      }
    }
    return parVille;
  } catch {
    return VIDE;
  }
}

/** La source à passer au moteur, ou `undefined` quand on n'a rien de mieux. */
export function sourceClimat(
  normales: NormalesParVille,
  month: number | undefined,
): ((destination: Destination) => MonthlyClimate | undefined) | undefined {
  if (month === undefined || Object.keys(normales).length === 0) return undefined;
  return (destination) => climateFromSeries(normales[destination.id], month);
}

function estNombre(valeur: unknown): valeur is number {
  return typeof valeur === 'number' && Number.isFinite(valeur);
}
