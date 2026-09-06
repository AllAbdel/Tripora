import type { PreferenceAxis } from './preferences.js';

/**
 * Lecture des étiquettes OpenStreetMap.
 *
 * OSM ne classe pas les lieux par « envie de voyage » : il décrit des objets
 * avec des paires clé-valeur. C'est ici qu'un `tourism=museum` devient de la
 * culture et un `natural=beach` de la détente, pour que l'itinéraire puisse
 * servir la première envie de chaque participant avec de vrais lieux.
 *
 * Le classement est **déterministe et testé**, pas deviné par un modèle : c'est
 * la même règle que partout ailleurs dans Tripora. Un lieu qu'aucune règle ne
 * reconnaît est écarté plutôt que rangé au hasard — mieux vaut une liste courte
 * et juste qu'une liste longue et fausse.
 *
 * Ce qui n'est délibérément pas couvert : les restaurants et les bars. OSM en
 * référence des milliers par ville, sans note ni prix fiables. Les classer
 * reviendrait à recommander au hasard. L'itinéraire réserve donc des créneaux
 * de repas sans prétendre nommer la table.
 */

export type PoiCategory =
  | 'musee'
  | 'monument'
  | 'oeuvre'
  | 'spectacle'
  | 'parc'
  | 'plage'
  | 'panorama'
  | 'nature'
  | 'marche'
  | 'boutique'
  | 'detente'
  | 'sport';

export interface PoiClassification {
  category: PoiCategory;
  /** Envie principale servie par ce lieu. */
  axis: PreferenceAxis;
  /** Libellé français, affichable tel quel. */
  label: string;
}

/**
 * Règles lues dans l'ordre : la première qui reconnaît le lieu gagne. Elles
 * vont donc du plus spécifique au plus général.
 */
const REGLES: readonly {
  key: string;
  values: readonly string[];
  result: PoiClassification;
}[] = [
  {
    key: 'tourism',
    values: ['museum', 'gallery'],
    result: { category: 'musee', axis: 'culture', label: 'Musée' },
  },
  {
    key: 'tourism',
    values: ['artwork'],
    result: { category: 'oeuvre', axis: 'offbeat', label: 'Œuvre dans la rue' },
  },
  {
    key: 'tourism',
    values: ['viewpoint'],
    result: { category: 'panorama', axis: 'nature', label: 'Point de vue' },
  },
  {
    key: 'tourism',
    values: ['zoo', 'aquarium', 'theme_park'],
    result: { category: 'nature', axis: 'nature', label: 'Parc à visiter' },
  },
  {
    key: 'historic',
    values: [
      'castle',
      'monument',
      'ruins',
      'city_gate',
      'fort',
      'archaeological_site',
      'church',
      'tower',
    ],
    result: { category: 'monument', axis: 'culture', label: 'Monument' },
  },
  {
    key: 'historic',
    values: ['memorial'],
    result: { category: 'oeuvre', axis: 'offbeat', label: 'Mémorial' },
  },
  {
    key: 'amenity',
    values: ['theatre', 'arts_centre'],
    result: { category: 'spectacle', axis: 'culture', label: 'Salle de spectacle' },
  },
  {
    key: 'amenity',
    values: ['marketplace'],
    result: { category: 'marche', axis: 'shopping', label: 'Marché' },
  },
  {
    key: 'leisure',
    values: ['park', 'garden'],
    result: { category: 'parc', axis: 'nature', label: 'Parc ou jardin' },
  },
  {
    key: 'leisure',
    values: ['spa', 'beach_resort'],
    result: { category: 'detente', axis: 'relax', label: 'Détente' },
  },
  {
    key: 'leisure',
    values: ['sports_centre', 'water_park', 'climbing'],
    result: { category: 'sport', axis: 'adventure', label: 'Activité sportive' },
  },
  {
    key: 'natural',
    values: ['beach'],
    result: { category: 'plage', axis: 'relax', label: 'Plage' },
  },
  {
    key: 'natural',
    values: ['peak', 'cliff', 'cave_entrance'],
    result: { category: 'nature', axis: 'adventure', label: 'Site naturel' },
  },
  {
    key: 'shop',
    values: ['mall', 'department_store'],
    result: { category: 'boutique', axis: 'shopping', label: 'Centre commercial' },
  },
  // Volontairement en dernier : « attraction » est le fourre-tout d'OSM, il ne
  // doit gagner que si rien de plus précis n'a répondu.
  {
    key: 'tourism',
    values: ['attraction'],
    result: { category: 'monument', axis: 'culture', label: 'À voir' },
  },
];

/**
 * Ce qu'on refuse avant même de regarder les règles.
 *
 * OpenStreetMap étiquette les arbres remarquables `tourism=attraction`, ce qui
 * les faisait entrer comme monuments — et leur étiquette Wikipédia pointe vers
 * l'espèce botanique, pas vers l'arbre. Le figuier de la baie de Moreton du
 * jardin de Lisbonne arrivait donc avec la fiche « Ficus macrophylla ». Un
 * arbre n'est pas une visite, et une fiche d'espèce n'est pas une description
 * de lieu.
 */
const REFUS: readonly { key: string; values: readonly string[] }[] = [
  { key: 'natural', values: ['tree', 'shrub'] },
];

/** Classe un lieu d'après ses étiquettes, ou rien si aucune règle ne le reconnaît. */
export function classifyPoi(
  tags: Readonly<Record<string, string>>,
): PoiClassification | undefined {
  for (const refus of REFUS) {
    const valeur = tags[refus.key];
    if (valeur !== undefined && refus.values.includes(valeur)) return undefined;
  }
  for (const regle of REGLES) {
    const valeur = tags[regle.key];
    if (valeur !== undefined && regle.values.includes(valeur)) return regle.result;
  }
  return undefined;
}

export interface Poi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: PoiCategory;
  axis: PreferenceAxis;
  label: string;
  /** Titre d'article Wikipédia, quand OSM en connaît un. */
  wikipedia?: string;
  extract?: string;
  imageUrl?: string;
  externalUrl?: string;
}

/**
 * Ordre de présentation d'une liste de lieux.
 *
 * Deux critères, dans cet ordre : les envies du groupe d'abord — un groupe qui
 * a coché « culture » voit les musées avant les centres commerciaux —, puis la
 * richesse de la fiche, parce qu'un lieu documenté par Wikipédia est presque
 * toujours plus intéressant qu'un point posé sans description.
 *
 * À poids égal, on trie par nom : le classement doit être stable d'un
 * affichage à l'autre, sinon la liste danse sous les doigts.
 */
export function rankPois(
  places: readonly Poi[],
  weights: Partial<Record<PreferenceAxis, number>> = {},
): Poi[] {
  const note = (lieu: Poi): number => {
    const envie = weights[lieu.axis] ?? 0.35;
    const documente = lieu.extract ? 0.25 : 0;
    const illustre = lieu.imageUrl ? 0.1 : 0;
    return envie + documente + illustre;
  };
  return [...places].sort(
    (a, b) => note(b) - note(a) || a.name.localeCompare(b.name, 'fr'),
  );
}

/** Regroupe par catégorie, en gardant l'ordre d'entrée dans chaque groupe. */
export function groupPoisByCategory(
  places: readonly Poi[],
): { category: PoiCategory; label: string; places: Poi[] }[] {
  const groupes = new Map<PoiCategory, { category: PoiCategory; label: string; places: Poi[] }>();
  for (const lieu of places) {
    const existant = groupes.get(lieu.category);
    if (existant) existant.places.push(lieu);
    else groupes.set(lieu.category, { category: lieu.category, label: lieu.label, places: [lieu] });
  }
  return [...groupes.values()];
}
