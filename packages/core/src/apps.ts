/**
 * Les applications à installer avant de partir, triées pour une destination.
 *
 * Le catalogue est mondial mais l'écran ne l'est pas : à Istanbul, on veut voir
 * l'İstanbulkart et BiTaksi, pas la carte de transport japonaise. Ce module
 * fait le tri, et surtout il l'ordonne — c'est là que se joue l'utilité, parce
 * que personne ne lit cinquante fiches.
 *
 * Trois règles, dans cet ordre :
 *
 *  1. **le plus local d'abord.** Une application citée pour cette ville
 *     précise sait quelque chose qu'une application mondiale ignore. Une
 *     application nationale de même. Le classement le reflète avant toute
 *     autre considération ;
 *  2. **à portée égale, l'utilité affichée.** La priorité est un jugement
 *     assumé, saisi à la main : « ne pas connaître ça coûte cher » vaut 90,
 *     « c'est confortable » vaut 55 ;
 *  3. **une seule catégorie n'écrase pas l'écran.** Les catégories sont
 *     servies dans l'ordre du voyage — se connecter, s'orienter, se déplacer,
 *     dormir — et chacune est plafonnée, sinon les six applications de
 *     livraison de repas repoussent le reste hors de vue.
 *
 * Aucun appel réseau ici : on reçoit les fiches, on les range. Le même calcul
 * sert donc à l'affichage et aux tests.
 */

/** Les rubriques, dans l'ordre où elles servent réellement à un voyageur. */
export const CATEGORIES_APP = [
  'connectivite',
  'orientation',
  'transport_local',
  'transport_longue',
  'hebergement',
  'activites',
  'nourriture',
  'argent',
  'langue',
  'securite',
] as const;

export type CategorieApp = (typeof CATEGORIES_APP)[number];

export const LIBELLES_CATEGORIE: Readonly<Record<CategorieApp, string>> = {
  connectivite: 'Rester connecté',
  orientation: 'S’orienter',
  transport_local: 'Se déplacer sur place',
  transport_longue: 'Aller d’une ville à l’autre',
  hebergement: 'Se loger',
  activites: 'Visiter et réserver',
  nourriture: 'Manger',
  argent: 'Payer et changer',
  langue: 'Se faire comprendre',
  securite: 'Avant de partir',
};

export interface ApplicationUtile {
  id: string;
  name: string;
  category: CategorieApp;
  tagline: string;
  why: string;
  caveat: string | null;
  iosUrl: string | null;
  androidUrl: string | null;
  webUrl: string | null;
  /** Codes pays ISO 3166-1 alpha-2. Vide = partout. */
  countryCodes: readonly string[];
  /** Identifiants de destination du catalogue. Vide = pas de ville imposée. */
  destinationIds: readonly string[];
  priority: number;
}

/** À quel point la fiche a été écrite pour cet endroit-là. */
export type PorteeApp = 'ville' | 'pays' | 'monde';

export interface ApplicationClassee extends ApplicationUtile {
  portee: PorteeApp;
}

export interface RubriqueApp {
  categorie: CategorieApp;
  libelle: string;
  applications: readonly ApplicationClassee[];
  /** Combien la rubrique en contenait avant plafonnement. */
  total: number;
}

/** Où l'on va. Les deux champs sont facultatifs : sans destination arrêtée,
 *  on montre quand même ce qui sert partout. */
export interface DestinationCible {
  destinationId?: string | null;
  countryCode?: string | null;
}

const RANG_PORTEE: Readonly<Record<PorteeApp, number>> = {
  ville: 0,
  pays: 1,
  monde: 2,
};

/**
 * Au-delà, une rubrique cesse d'être une liste et devient un annuaire.
 * Six applications de livraison ne valent pas mieux que trois : c'est la
 * même décision, prise une fois.
 */
const PAR_RUBRIQUE = 4;

function normaliserPays(code: string | null | undefined): string {
  return (code ?? '').trim().toUpperCase();
}

/**
 * La portée d'une fiche pour un endroit donné, ou `null` si elle ne le
 * concerne pas.
 *
 * Une fiche qui nomme des villes ne sort que pour ces villes-là, même si le
 * pays correspond : l'İstanbulkart n'aide personne à Antalya. C'est le sens
 * de la nuance entre les deux colonnes, et c'est volontairement strict.
 */
export function porteeDeApplication(
  app: ApplicationUtile,
  cible: DestinationCible,
): PorteeApp | null {
  const villes = app.destinationIds;
  const pays = app.countryCodes;

  if (villes.length > 0) {
    return cible.destinationId && villes.includes(cible.destinationId) ? 'ville' : null;
  }
  if (pays.length > 0) {
    const code = normaliserPays(cible.countryCode);
    return code !== '' && pays.map((p) => p.toUpperCase()).includes(code) ? 'pays' : null;
  }
  return 'monde';
}

function comparer(a: ApplicationClassee, b: ApplicationClassee): number {
  const parPortee = RANG_PORTEE[a.portee] - RANG_PORTEE[b.portee];
  if (parPortee !== 0) return parPortee;
  if (a.priority !== b.priority) return b.priority - a.priority;
  // Dernier départage : l'ordre alphabétique, pour que deux affichages
  // successifs du même écran ne se réordonnent pas dans le dos de l'utilisateur.
  return a.name.localeCompare(b.name, 'fr');
}

/**
 * Les applications qui concernent cet endroit, classées, sans regroupement.
 *
 * Utile quand on veut les dix premières toutes catégories confondues — par
 * exemple un encart « à installer avant de partir » sur l'aperçu du voyage.
 */
export function applicationsPour(
  catalogue: readonly ApplicationUtile[],
  cible: DestinationCible,
): ApplicationClassee[] {
  const retenues: ApplicationClassee[] = [];
  for (const app of catalogue) {
    const portee = porteeDeApplication(app, cible);
    if (portee) retenues.push({ ...app, portee });
  }
  return retenues.sort(comparer);
}

/**
 * Les mêmes, rangées par rubrique et plafonnées.
 *
 * Les rubriques vides disparaissent : un titre sans rien dessous laisse croire
 * que le chargement a échoué.
 */
export function rubriquesPour(
  catalogue: readonly ApplicationUtile[],
  cible: DestinationCible,
  parRubrique = PAR_RUBRIQUE,
): RubriqueApp[] {
  const classees = applicationsPour(catalogue, cible);
  const rubriques: RubriqueApp[] = [];

  for (const categorie of CATEGORIES_APP) {
    const dedans = classees.filter((app) => app.category === categorie);
    if (dedans.length === 0) continue;
    rubriques.push({
      categorie,
      libelle: LIBELLES_CATEGORIE[categorie],
      applications: dedans.slice(0, parRubrique),
      total: dedans.length,
    });
  }

  return rubriques;
}

/**
 * Ce qu'on met en avant : les quelques-unes qui changent vraiment le séjour.
 *
 * On ne prend qu'une application par catégorie — deux applications de taxi en
 * tête de liste, c'est une comparaison à faire, pas un conseil. Et on écarte
 * les fiches mondiales quand il existe assez de local : quelqu'un qui part à
 * Istanbul sait déjà ce qu'est Google Maps.
 */
export function essentielles(
  catalogue: readonly ApplicationUtile[],
  cible: DestinationCible,
  combien = 5,
): ApplicationClassee[] {
  const classees = applicationsPour(catalogue, cible);
  const locales = classees.filter((app) => app.portee !== 'monde');
  const source = locales.length >= combien ? locales : classees;

  const vues = new Set<CategorieApp>();
  const tete: ApplicationClassee[] = [];
  for (const app of source) {
    if (vues.has(app.category)) continue;
    vues.add(app.category);
    tete.push(app);
    if (tete.length === combien) break;
  }
  return tete;
}
