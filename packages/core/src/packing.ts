import { climateFor } from './catalog/climate.js';
import { targetMonth } from './dates.js';
import type { NomIcone } from './icons.js';
import type { PreferenceAxis, PreferenceWeights } from './preferences.js';
import type { Destination, MonthlyClimate, TripConstraints } from './types.js';

/**
 * Ce qu'il faut mettre dans la valise, et en quelle quantité.
 *
 * Une liste de bagage générique ne sert à personne : « pensez à des vêtements
 * chauds » n'a jamais empêché quiconque de grelotter. Ce module part de ce que
 * Tripora sait déjà et qui est mesuré — les normales climatiques de la ville
 * pour le mois visé, la durée du séjour, les envies du groupe — et en tire des
 * quantités et des raisons.
 *
 * Trois principes.
 *
 * **Chaque ligne porte son pourquoi.** « 4 t-shirts » ne se discute pas ;
 * « 4 t-shirts — 6 jours, avec une lessive à mi-séjour » se discute, et c'est
 * ce qu'on veut : la liste est un point de départ, pas un ordre.
 *
 * **Rien n'est déduit d'une identité.** L'application ne demande pas le genre
 * de qui que ce soit pour proposer un soutien-gorge ou des protections
 * périodiques. Elle propose des **besoins à cocher**, que chacun renseigne pour
 * lui-même. C'est plus juste — une liste fondée sur le genre se trompe pour
 * beaucoup de gens — et c'est plus utile, parce que ça marche aussi pour le
 * rasage, les lentilles ou un traitement quotidien.
 *
 * **Ce qui se partage est signalé.** Un adaptateur secteur, une trousse à
 * pharmacie, un sèche-cheveux : à quatre, en emporter quatre est une erreur
 * que personne ne remarque avant d'avoir porté les sacs. Ces articles sont
 * marqués, et l'écran permet à quelqu'un de s'en charger pour le groupe.
 *
 * Aucun appel réseau, aucun modèle de langage : ce sont des règles écrites,
 * lisibles et testables. Une liste de bagage inventée oublierait le chargeur.
 */

// ---------------------------------------------------------------------------
// Ce qu'on demande à la personne
// ---------------------------------------------------------------------------

/**
 * Les besoins qu'on ne peut pas deviner.
 *
 * Volontairement formulés comme des besoins et non comme des catégories de
 * personnes : c'est ce qui permet à la liste d'être juste sans rien supposer.
 */
export const BESOINS = [
  'soutien-gorge',
  'protections-periodiques',
  'rasage',
  'maquillage',
  'lentilles',
  'lunettes',
  'traitement-quotidien',
  'appareil-photo',
  'ordinateur',
] as const;

export type Besoin = (typeof BESOINS)[number];

export const LIBELLES_BESOIN: Readonly<Record<Besoin, string>> = {
  'soutien-gorge': 'Soutiens-gorge',
  'protections-periodiques': 'Protections périodiques',
  rasage: 'Rasage',
  maquillage: 'Maquillage',
  lentilles: 'Lentilles de contact',
  lunettes: 'Lunettes de vue',
  'traitement-quotidien': 'Traitement quotidien',
  'appareil-photo': 'Appareil photo',
  ordinateur: 'Ordinateur portable',
};

export interface ProfilValise {
  /** Ce que la personne a coché. Rien coché = liste sans effets personnels. */
  besoins: readonly Besoin[];
  /** Vrai si le logement a une machine à laver, ou si le séjour permet une lessive. */
  lessivePossible: boolean;
  /** Vrai en bagage cabine seul : les quantités se resserrent et les liquides comptent. */
  cabineSeulement: boolean;
}

export const PROFIL_PAR_DEFAUT: ProfilValise = {
  besoins: [],
  lessivePossible: false,
  cabineSeulement: false,
};

// ---------------------------------------------------------------------------
// Ce qu'on en tire
// ---------------------------------------------------------------------------

export const RUBRIQUES_VALISE = [
  'papiers',
  'vetements',
  'chaussures',
  'toilette',
  'sante',
  'electronique',
  'activites',
  'divers',
] as const;

export type RubriqueValise = (typeof RUBRIQUES_VALISE)[number];

export const LIBELLES_RUBRIQUE: Readonly<Record<RubriqueValise, string>> = {
  papiers: 'Papiers et argent',
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  toilette: 'Trousse de toilette',
  sante: 'Santé',
  electronique: 'Électronique',
  activites: 'Pour ce qui est prévu',
  divers: 'Divers',
};

export const ICONES_RUBRIQUE: Readonly<Record<RubriqueValise, NomIcone>> = {
  papiers: 'papiers',
  vetements: 'vetements',
  chaussures: 'chaussures',
  toilette: 'toilette',
  sante: 'sante',
  electronique: 'electronique',
  activites: 'aventure',
  divers: 'divers',
};

export interface ArticleValise {
  /** Identifiant stable : sert de clé de rangement et de cochage. */
  id: string;
  label: string;
  rubrique: RubriqueValise;
  /** Combien en emporter. `null` quand la question ne se pose pas (une trousse). */
  quantite: number | null;
  /** Pourquoi cet article, et pourquoi cette quantité. Toujours renseigné. */
  pourquoi: string;
  /** Vrai quand l'oublier gâche le voyage — pas seulement gêne. */
  essentiel: boolean;
  /** Vrai quand un seul suffit pour tout le groupe. */
  partageable: boolean;
}

export interface RubriqueRemplie {
  rubrique: RubriqueValise;
  libelle: string;
  icone: NomIcone;
  articles: readonly ArticleValise[];
}

// ---------------------------------------------------------------------------
// La lecture du climat
// ---------------------------------------------------------------------------

/** Le caractère du temps qu'il fera, en une catégorie. */
export type Temps = 'caniculaire' | 'chaud' | 'doux' | 'frais' | 'froid' | 'glacial';

export interface LectureDuClimat {
  temps: Temps;
  /** Écart entre le jour et la nuit : au-delà de 10 °C, il faut des couches. */
  amplitude: number;
  /** Vrai quand il pleut plus d'un jour sur trois. */
  pluvieux: boolean;
  /** Vrai quand il gèle la nuit. */
  gel: boolean;
  /** La phrase qui justifie tout le reste, réutilisée dans les explications. */
  resume: string;
}

const SEUILS: readonly { max: number; temps: Temps }[] = [
  { max: 5, temps: 'glacial' },
  { max: 12, temps: 'froid' },
  { max: 19, temps: 'frais' },
  { max: 26, temps: 'doux' },
  { max: 32, temps: 'chaud' },
  { max: Infinity, temps: 'caniculaire' },
];

/**
 * Ce que disent les normales du mois.
 *
 * On classe sur la **température maximale moyenne**, celle qu'on vit dans la
 * journée. La minimale sert à l'amplitude : c'est elle qui décide s'il faut
 * une couche de plus pour le soir, et c'est l'erreur la plus courante — on
 * regarde « 28 °C à Marrakech » et on oublie les 10 °C de la nuit.
 */
export function lireLeClimat(climat: MonthlyClimate | undefined): LectureDuClimat | null {
  if (!climat) return null;

  const temps = SEUILS.find((seuil) => climat.avgHighC < seuil.max)?.temps ?? 'doux';
  const amplitude = Math.round(climat.avgHighC - climat.avgLowC);
  const pluvieux = climat.rainyDays >= 10;
  const gel = climat.avgLowC <= 1;

  const jour = Math.round(climat.avgHighC);
  const nuit = Math.round(climat.avgLowC);
  const parties = [`${jour} °C le jour, ${nuit} °C la nuit`];
  if (pluvieux) parties.push(`${climat.rainyDays} jours de pluie dans le mois`);

  return { temps, amplitude, pluvieux, gel, resume: parties.join(', ') };
}

// ---------------------------------------------------------------------------
// La liste
// ---------------------------------------------------------------------------

/** Ajoute un article, sauf si un article du même identifiant existe déjà. */
function poser(
  liste: ArticleValise[],
  article: Omit<ArticleValise, 'essentiel' | 'partageable'> &
    Partial<Pick<ArticleValise, 'essentiel' | 'partageable'>>,
): void {
  if (liste.some((existant) => existant.id === article.id)) return;
  liste.push({ essentiel: false, partageable: false, ...article });
}

/**
 * Combien de hauts, de bas et de sous-vêtements pour tenir.
 *
 * La règle usuelle est « un par jour », et elle est mauvaise au-delà d'une
 * semaine : personne ne part avec quatorze pantalons. On plafonne donc, en
 * distinguant ce qui se porte à même la peau — non négociable — de ce qui se
 * reporte sans gêne.
 */
function quantites(jours: number, profil: ProfilValise) {
  const plafond = profil.cabineSeulement ? 5 : 7;
  const lessive = profil.lessivePossible;

  return {
    /** Contre la peau : un par jour, plus une marge, sauf lessive. */
    intime: Math.min(lessive ? 5 : jours + 1, profil.cabineSeulement ? 6 : 10),
    /** Hauts : un par jour tant que c'est raisonnable. */
    hauts: Math.min(lessive ? 4 : jours + 1, plafond),
    /** Bas : un pour deux à trois jours, jamais moins de deux. */
    bas: Math.max(2, Math.min(Math.ceil(jours / 3), profil.cabineSeulement ? 2 : 4)),
    /** Pulls et vestes : deux suffisent presque toujours. */
    couches: profil.cabineSeulement ? 1 : 2,
  };
}

function envieForte(poids: PreferenceWeights | undefined, axe: PreferenceAxis): boolean {
  return (poids?.[axe] ?? 0) >= 0.6;
}

/**
 * La liste complète, rangée par rubrique.
 *
 * `envies` est facultatif : sans lui on obtient une liste correcte, seulement
 * moins précise. C'est voulu — la valise doit pouvoir se préparer avant que
 * tout le monde ait rempli son profil.
 */
export function preparerLaValise({
  destination,
  constraints,
  envies,
  profil = PROFIL_PAR_DEFAUT,
}: {
  destination: Destination;
  constraints: TripConstraints;
  envies?: PreferenceWeights;
  profil?: ProfilValise;
}): RubriqueRemplie[] {
  const jours = Math.max(1, constraints.durationDays);
  const mois = targetMonth(constraints);
  const climat = mois === undefined ? null : lireLeClimat(climateFor(destination.id, mois));
  const q = quantites(jours, profil);
  const articles: ArticleValise[] = [];

  const duree = `${jours} jour${jours > 1 ? 's' : ''}`;
  const meteo = climat ? climat.resume : 'climat inconnu pour ce mois';
  const rythme = profil.lessivePossible ? ', avec une lessive sur place' : '';

  // ------------------------------------------------------------- Papiers --
  const memePays = memePaysQueLeDepart(constraints, destination);
  poser(articles, {
    id: 'piece-identite',
    label: memePays ? 'Carte d’identité' : 'Passeport ou carte d’identité',
    rubrique: 'papiers',
    quantite: 1,
    pourquoi: memePays
      ? 'Voyage intérieur : une pièce d’identité suffit, mais elle reste obligatoire à l’hôtel.'
      : 'Vérifiez sa validité : plusieurs pays exigent six mois au-delà de la date de retour.',
    essentiel: true,
  });
  if (!memePays) {
    poser(articles, {
      id: 'visa',
      label: 'Visa ou autorisation de voyage',
      rubrique: 'papiers',
      quantite: null,
      pourquoi:
        'À vérifier sur le site officiel du pays : les règles changent, et les intermédiaires facturent des démarches parfois gratuites.',
      essentiel: true,
    });
    poser(articles, {
      id: 'assurance',
      label: 'Attestation d’assurance voyage',
      rubrique: 'papiers',
      quantite: null,
      pourquoi:
        'Souvent incluse avec une carte bancaire, à condition d’avoir payé le voyage avec. Le numéro suffit, en photo.',
    });
  }
  poser(articles, {
    id: 'cartes-bancaires',
    label: 'Deux moyens de paiement',
    rubrique: 'papiers',
    quantite: 2,
    pourquoi:
      'Une carte avalée ou bloquée à l’étranger arrive plus souvent qu’on ne croit. Deux cartes de deux banques différentes, rangées séparément.',
    essentiel: true,
  });
  poser(articles, {
    id: 'especes',
    label: 'Un peu d’espèces',
    rubrique: 'papiers',
    quantite: null,
    pourquoi:
      'De quoi payer un taxi et un repas à l’arrivée, avant d’avoir trouvé un distributeur qui accepte votre carte.',
  });

  // ------------------------------------------------------------ Vêtements --
  poser(articles, {
    id: 'sous-vetements',
    label: 'Sous-vêtements',
    rubrique: 'vetements',
    quantite: q.intime,
    pourquoi: `${duree}${rythme}.`,
    essentiel: true,
  });
  poser(articles, {
    id: 'chaussettes',
    label: 'Paires de chaussettes',
    rubrique: 'vetements',
    quantite: q.intime,
    pourquoi: `${duree}${rythme}. Prévoyez-en une paire de plus si vous marchez beaucoup.`,
    essentiel: true,
  });
  poser(articles, {
    id: 'pyjama',
    label: 'De quoi dormir',
    rubrique: 'vetements',
    quantite: 1,
    pourquoi: climat?.gel
      ? 'Les nuits gèlent : quelque chose de chaud, même si le logement est chauffé.'
      : 'Une tenue légère suffit.',
  });

  ajouterVetementsSelonLeTemps(articles, climat, q, meteo);
  ajouterChaussures(articles, climat, envies, jours);

  // --------------------------------------------------------------- Besoins --
  ajouterBesoins(articles, profil, jours);

  // -------------------------------------------------------------- Toilette --
  poser(articles, {
    id: 'brosse-a-dents',
    label: 'Brosse à dents et dentifrice',
    rubrique: 'toilette',
    quantite: null,
    pourquoi: profil.cabineSeulement
      ? 'En cabine, le dentifrice compte dans les 100 ml : prenez un petit tube.'
      : 'L’oubli le plus fréquent, et le plus pénible à réparer un dimanche soir.',
    essentiel: true,
  });
  poser(articles, {
    id: 'deodorant',
    label: 'Déodorant',
    rubrique: 'toilette',
    quantite: null,
    pourquoi:
      climat?.temps === 'chaud' || climat?.temps === 'caniculaire'
        ? `Il fera ${meteo} : prévoyez large.`
        : 'Rien à ajouter.',
  });
  poser(articles, {
    id: 'douche',
    label: 'Gel douche et shampoing',
    rubrique: 'toilette',
    quantite: null,
    pourquoi: profil.cabineSeulement
      ? 'En format voyage : au-delà de 100 ml, ils seront jetés au contrôle.'
      : 'Beaucoup de logements en fournissent — un coup d’œil à l’annonce évite de les porter.',
    partageable: true,
  });
  if (profil.cabineSeulement) {
    poser(articles, {
      id: 'sachet-liquides',
      label: 'Sachet transparent pour les liquides',
      rubrique: 'toilette',
      quantite: 1,
      pourquoi:
        'Un litre maximum, flacons de 100 ml au plus. Sans le sachet, le contrôle vous les prend.',
      essentiel: true,
    });
  }
  poser(articles, {
    id: 'serviette',
    label: 'Serviette microfibre',
    rubrique: 'toilette',
    quantite: 1,
    pourquoi:
      'Sèche en une heure et ne prend pas de place. Inutile à l’hôtel, indispensable en auberge.',
  });

  // ---------------------------------------------------------------- Santé --
  poser(articles, {
    id: 'pharmacie',
    label: 'Petite trousse à pharmacie',
    rubrique: 'sante',
    quantite: null,
    pourquoi:
      'Antidouleur, pansements, anti-diarrhéique, désinfectant. Une pharmacie fermée un jour férié dans un pays dont on ne parle pas la langue, c’est la soirée gâchée.',
    partageable: true,
  });
  if (climat && (climat.temps === 'chaud' || climat.temps === 'caniculaire')) {
    poser(articles, {
      id: 'creme-solaire',
      label: 'Crème solaire',
      rubrique: 'sante',
      quantite: null,
      pourquoi: `${meteo} : le premier jour de coup de soleil coûte les trois suivants.`,
      essentiel: true,
    });
    poser(articles, {
      id: 'gourde',
      label: 'Gourde',
      rubrique: 'sante',
      quantite: 1,
      pourquoi:
        'Par cette chaleur, on boit trois litres par jour. Achetés à l’unité, ça fait beaucoup de bouteilles et beaucoup d’argent.',
    });
  }
  if (destination.lat > -35 && destination.lat < 35 && !climat?.gel) {
    poser(articles, {
      id: 'anti-moustiques',
      label: 'Anti-moustiques',
      rubrique: 'sante',
      quantite: null,
      pourquoi:
        'Sous ces latitudes, les moustiques sont actifs presque toute l’année. À vérifier aussi : les recommandations sanitaires officielles pour ce pays.',
      partageable: true,
    });
  }

  // --------------------------------------------------------- Électronique --
  poser(articles, {
    id: 'chargeur',
    label: 'Chargeur de téléphone et câble',
    rubrique: 'electronique',
    quantite: 1,
    pourquoi: 'Le seul objet dont l’oubli se paie dès le premier soir.',
    essentiel: true,
  });
  const prise = typeDePrise(destination.countryCode);
  if (prise && !memePays) {
    poser(articles, {
      id: 'adaptateur',
      label: `Adaptateur de prise (type ${prise})`,
      rubrique: 'electronique',
      quantite: 1,
      pourquoi: `Les prises y sont de type ${prise}. Un adaptateur universel suffit pour tout le groupe.`,
      essentiel: true,
      partageable: true,
    });
  }
  poser(articles, {
    id: 'batterie',
    label: 'Batterie externe',
    rubrique: 'electronique',
    quantite: 1,
    pourquoi:
      'Une journée de carte, de photos et de traduction vide un téléphone avant le dîner. À mettre en bagage cabine : les batteries sont interdites en soute.',
  });

  // ----------------------------------------------------------- Activités --
  ajouterSelonLesEnvies(articles, envies, climat, destination);

  // ------------------------------------------------------------- Divers --
  poser(articles, {
    id: 'sac-a-dos',
    label: 'Petit sac à dos',
    rubrique: 'divers',
    quantite: 1,
    pourquoi: 'Pour la journée : eau, veste, appareil photo. Le grand sac reste au logement.',
  });
  poser(articles, {
    id: 'sac-linge-sale',
    label: 'Sac pour le linge sale',
    rubrique: 'divers',
    quantite: 1,
    pourquoi: 'Un simple sac plastique. Sans lui, tout le contenu de la valise finit par sentir.',
  });
  if (jours >= 5) {
    poser(articles, {
      id: 'lessive',
      label: 'Lessive en petit format',
      rubrique: 'divers',
      quantite: null,
      pourquoi: `${duree} : une lessive à mi-séjour permet d’emporter moitié moins de vêtements.`,
    });
  }

  return RUBRIQUES_VALISE.map((rubrique) => ({
    rubrique,
    libelle: LIBELLES_RUBRIQUE[rubrique],
    icone: ICONES_RUBRIQUE[rubrique],
    articles: articles.filter((article) => article.rubrique === rubrique),
  })).filter((groupe) => groupe.articles.length > 0);
}

function ajouterVetementsSelonLeTemps(
  articles: ArticleValise[],
  climat: LectureDuClimat | null,
  q: ReturnType<typeof quantites>,
  meteo: string,
): void {
  // Sans normales, on reste honnête : une garde-robe polyvalente et on le dit.
  if (!climat) {
    poser(articles, {
      id: 'hauts-polyvalents',
      label: 'Hauts',
      rubrique: 'vetements',
      quantite: q.hauts,
      pourquoi:
        'Aucune normale climatique pour ce mois : prévoyez de quoi superposer plutôt que de parier sur une saison.',
    });
    poser(articles, {
      id: 'pull',
      label: 'Pull ou sweat',
      rubrique: 'vetements',
      quantite: q.couches,
      pourquoi: 'La couche qui rattrape une erreur de météo.',
    });
    return;
  }

  const chaud = climat.temps === 'chaud' || climat.temps === 'caniculaire';
  const froid = climat.temps === 'froid' || climat.temps === 'glacial';

  poser(articles, {
    id: 'tshirts',
    label: chaud ? 'T-shirts légers' : 'T-shirts',
    rubrique: 'vetements',
    quantite: q.hauts,
    pourquoi: chaud
      ? `${meteo} : privilégiez le coton ou le lin, qui sèchent et ne collent pas.`
      : `${meteo} : ils servent de première couche.`,
  });

  if (chaud) {
    poser(articles, {
      id: 'shorts',
      label: 'Shorts ou robes légères',
      rubrique: 'vetements',
      quantite: q.bas,
      pourquoi: `${meteo}.`,
    });
    poser(articles, {
      id: 'chapeau',
      label: 'Chapeau ou casquette',
      rubrique: 'vetements',
      quantite: 1,
      pourquoi: 'Le soleil de milieu de journée se supporte mal tête nue.',
      essentiel: climat.temps === 'caniculaire',
    });
    poser(articles, {
      id: 'lunettes-soleil',
      label: 'Lunettes de soleil',
      rubrique: 'vetements',
      quantite: 1,
      pourquoi: 'Rien à ajouter.',
    });
  }

  if (!chaud || climat.amplitude > 12) {
    poser(articles, {
      id: 'pantalons',
      label: 'Pantalons ou jeans',
      rubrique: 'vetements',
      quantite: q.bas,
      pourquoi: chaud
        ? `L’amplitude atteint ${climat.amplitude} °C : le soir tombe plus frais qu’on ne l’imagine.`
        : `${meteo}.`,
    });
  }

  if (climat.temps === 'doux' || climat.temps === 'frais' || froid) {
    poser(articles, {
      id: 'pull',
      label: froid ? 'Pulls chauds' : 'Pull ou sweat',
      rubrique: 'vetements',
      quantite: q.couches,
      pourquoi: froid ? `${meteo}.` : 'Pour le matin et le soir.',
    });
  }

  if (froid) {
    poser(articles, {
      id: 'manteau',
      label: 'Manteau chaud',
      rubrique: 'vetements',
      quantite: 1,
      pourquoi: `${meteo}. Trois couches fines tiennent plus chaud qu’un seul vêtement épais.`,
      essentiel: true,
    });
    poser(articles, {
      id: 'bonnet-gants',
      label: 'Bonnet, gants, écharpe',
      rubrique: 'vetements',
      quantite: 1,
      pourquoi: climat.gel
        ? 'Il gèle la nuit : les extrémités sont ce qui rend une journée dehors insupportable.'
        : 'Le trio qui change tout dès qu’il y a du vent.',
      essentiel: climat.gel,
    });
    poser(articles, {
      id: 'thermique',
      label: 'Sous-couche thermique',
      rubrique: 'vetements',
      quantite: climat.temps === 'glacial' ? 2 : 1,
      pourquoi: 'La couche la plus efficace au poids, et la moins encombrante.',
    });
  } else if (climat.temps === 'frais' || climat.amplitude > 12) {
    poser(articles, {
      id: 'veste-legere',
      label: 'Veste légère',
      rubrique: 'vetements',
      quantite: 1,
      pourquoi: `Amplitude de ${climat.amplitude} °C entre le jour et la nuit.`,
    });
  }

  if (climat.pluvieux) {
    poser(articles, {
      id: 'impermeable',
      label: 'Veste imperméable',
      rubrique: 'vetements',
      quantite: 1,
      pourquoi: `${meteo} : un parapluie ne tient pas dans le vent, une capuche si.`,
      essentiel: true,
    });
  }
}

function ajouterChaussures(
  articles: ArticleValise[],
  climat: LectureDuClimat | null,
  envies: PreferenceWeights | undefined,
  jours: number,
): void {
  poser(articles, {
    id: 'chaussures-marche',
    label: 'Chaussures de marche confortables',
    rubrique: 'chaussures',
    quantite: 1,
    pourquoi: `On marche facilement quinze kilomètres par jour en ville. Des chaussures neuves sur ${jours} jours, c’est des ampoules dès le deuxième.`,
    essentiel: true,
  });

  if (climat && (climat.temps === 'chaud' || climat.temps === 'caniculaire')) {
    poser(articles, {
      id: 'sandales',
      label: 'Sandales ou tongs',
      rubrique: 'chaussures',
      quantite: 1,
      pourquoi: 'Pour le soir, la plage, et la douche partagée en auberge.',
    });
  }

  if (envieForte(envies, 'nightlife')) {
    poser(articles, {
      id: 'tenue-soir',
      label: 'Une tenue et des chaussures pour sortir',
      rubrique: 'chaussures',
      quantite: 1,
      pourquoi:
        'Plusieurs endroits refusent les baskets et le short. Une tenue suffit pour tout le séjour.',
    });
  }

  if (climat && (climat.temps === 'froid' || climat.temps === 'glacial')) {
    poser(articles, {
      id: 'chaussures-chaudes',
      label: 'Chaussures fermées et imperméables',
      rubrique: 'chaussures',
      quantite: 1,
      pourquoi: 'Des pieds mouillés par ce froid, et la journée s’arrête là.',
      essentiel: true,
    });
  }
}

function ajouterBesoins(
  articles: ArticleValise[],
  profil: ProfilValise,
  jours: number,
): void {
  const a = (besoin: Besoin) => profil.besoins.includes(besoin);

  if (a('soutien-gorge')) {
    poser(articles, {
      id: 'soutiens-gorge',
      label: 'Soutiens-gorge',
      rubrique: 'vetements',
      quantite: Math.min(3, Math.max(2, Math.ceil(jours / 3))),
      pourquoi: 'Deux à trois suffisent, quelle que soit la durée.',
    });
  }
  if (a('protections-periodiques')) {
    poser(articles, {
      id: 'protections',
      label: 'Protections périodiques',
      rubrique: 'toilette',
      quantite: null,
      pourquoi:
        'À emporter même hors période prévue : les marques et les formats habituels ne se trouvent pas partout.',
      essentiel: true,
    });
  }
  if (a('rasage')) {
    poser(articles, {
      id: 'rasage',
      label: 'Nécessaire de rasage',
      rubrique: 'toilette',
      quantite: null,
      pourquoi: profil.cabineSeulement
        ? 'Le rasoir mécanique passe en cabine ; les lames de sécurité non.'
        : 'Rien à ajouter.',
    });
  }
  if (a('maquillage')) {
    poser(articles, {
      id: 'maquillage',
      label: 'Trousse de maquillage',
      rubrique: 'toilette',
      quantite: null,
      pourquoi: profil.cabineSeulement
        ? 'Les produits liquides comptent dans le sachet des 100 ml ; les poudres non.'
        : 'Rien à ajouter.',
    });
  }
  if (a('lentilles')) {
    poser(articles, {
      id: 'lentilles',
      label: 'Lentilles, produit et étui',
      rubrique: 'sante',
      quantite: null,
      pourquoi:
        'Prenez une paire de lunettes en secours : un œil irrité en voyage, et les lentilles deviennent impossibles pour deux jours.',
      essentiel: true,
    });
  }
  if (a('lunettes')) {
    poser(articles, {
      id: 'lunettes',
      label: 'Lunettes de vue et étui',
      rubrique: 'sante',
      quantite: null,
      pourquoi: 'Emportez l’ordonnance en photo : une paire cassée se remplace plus vite avec.',
      essentiel: true,
    });
  }
  if (a('traitement-quotidien')) {
    poser(articles, {
      id: 'traitement',
      label: 'Traitement, en quantité suffisante',
      rubrique: 'sante',
      quantite: null,
      pourquoi:
        'Comptez quelques jours de plus que le séjour, gardez la boîte d’origine et l’ordonnance : c’est ce qui évite les questions à la douane.',
      essentiel: true,
    });
  }
  if (a('appareil-photo')) {
    poser(articles, {
      id: 'appareil-photo',
      label: 'Appareil photo, batteries et cartes',
      rubrique: 'electronique',
      quantite: null,
      pourquoi: 'Deux batteries : le froid comme la chaleur les vident plus vite qu’à la maison.',
    });
  }
  if (a('ordinateur')) {
    poser(articles, {
      id: 'ordinateur',
      label: 'Ordinateur et chargeur',
      rubrique: 'electronique',
      quantite: 1,
      pourquoi: 'En bagage cabine, toujours : une soute perdue emporte le travail avec elle.',
    });
  }
}

function ajouterSelonLesEnvies(
  articles: ArticleValise[],
  envies: PreferenceWeights | undefined,
  climat: LectureDuClimat | null,
  destination: Destination,
): void {
  const balnéaire = (destination.tags?.relax ?? 0) >= 0.6;
  const chaud = climat?.temps === 'chaud' || climat?.temps === 'caniculaire';

  if (envieForte(envies, 'nature') || envieForte(envies, 'adventure')) {
    poser(articles, {
      id: 'chaussures-rando',
      label: 'Chaussures de randonnée',
      rubrique: 'chaussures',
      quantite: 1,
      pourquoi:
        'Le groupe a coché nature ou aventure : des baskets de ville sur un sentier humide, c’est une cheville tordue.',
      essentiel: true,
    });
    poser(articles, {
      id: 'tenue-rando',
      label: 'Tenue de randonnée',
      rubrique: 'activites',
      quantite: 1,
      pourquoi:
        'Une couche qui sèche vite, une qui coupe le vent. Le coton reste mouillé toute la journée.',
    });
    poser(articles, {
      id: 'lampe-frontale',
      label: 'Lampe frontale',
      rubrique: 'activites',
      quantite: 1,
      pourquoi: 'La nuit tombe plus vite qu’on ne redescend.',
      partageable: true,
    });
  }

  if (balnéaire || (chaud && envieForte(envies, 'relax'))) {
    poser(articles, {
      id: 'maillot',
      label: 'Maillot de bain',
      rubrique: 'activites',
      quantite: 2,
      pourquoi: 'Deux, pour ne jamais en remettre un mouillé.',
    });
    poser(articles, {
      id: 'serviette-plage',
      label: 'Serviette de plage',
      rubrique: 'activites',
      quantite: 1,
      pourquoi: 'Beaucoup de logements en interdisent l’emprunt : une microfibre fait l’affaire.',
    });
  }

  if (envieForte(envies, 'culture')) {
    poser(articles, {
      id: 'tenue-lieux-de-culte',
      label: 'De quoi couvrir épaules et genoux',
      rubrique: 'activites',
      quantite: 1,
      pourquoi:
        'Beaucoup d’églises, de mosquées et de temples refusent l’entrée sans. Un foulard léger suffit.',
    });
  }
}

/**
 * Le pays de départ, quand on le connaît.
 *
 * L'origine d'un voyage est un point sur la carte, pas une entrée du
 * catalogue : elle porte un nom de pays en français, jamais un code ISO. On
 * compare donc au nom du pays de destination — c'est la seule information
 * commune aux deux, et elle suffit à savoir si l'on franchit une frontière.
 */
function memePaysQueLeDepart(constraints: TripConstraints, destination: Destination): boolean {
  const depart = constraints.origin.country?.trim().toLowerCase();
  return depart !== undefined && depart === destination.country.trim().toLowerCase();
}

/**
 * Le type de prise électrique d'un pays.
 *
 * Liste volontairement partielle : on ne nomme un type que là où il est net et
 * vérifiable. Ailleurs, on ne dit rien plutôt que d'affirmer — se retrouver
 * avec le mauvais adaptateur à cause de nous serait pire que de l'avoir oublié.
 */
const PRISES: Readonly<Record<string, string>> = {
  GB: 'G', IE: 'G', MT: 'G', CY: 'G', HK: 'G', SG: 'G', MY: 'G', AE: 'G', QA: 'G',
  US: 'A/B', CA: 'A/B', MX: 'A/B', JP: 'A/B', TW: 'A/B', PH: 'A/B', CO: 'A/B', PE: 'A/B',
  CH: 'J', IT: 'F/L', DK: 'K', ZA: 'M/N', IN: 'D/M', LK: 'D/M', NP: 'D/M',
  AU: 'I', NZ: 'I', CN: 'I/A', AR: 'I', FJ: 'I',
  BR: 'N', TH: 'A/B/C', VN: 'A/C', ID: 'C/F', KR: 'C/F', TR: 'C/F', MA: 'C/E', EG: 'C/F',
  FR: 'E', BE: 'E', PL: 'E', CZ: 'E', SK: 'E',
  DE: 'F', ES: 'F', PT: 'F', NL: 'F', AT: 'F', SE: 'F', NO: 'F', FI: 'F', GR: 'F',
  HR: 'F', HU: 'F', RO: 'F', BG: 'F', RS: 'F', SI: 'F', EE: 'F', LV: 'F', LT: 'F',
  IS: 'F', LU: 'F', GE: 'F', AM: 'F', AZ: 'F', KZ: 'F', UZ: 'F', MZ: 'F', KE: 'G',
};

export function typeDePrise(codePays: string): string | undefined {
  return PRISES[codePays.toUpperCase()];
}
