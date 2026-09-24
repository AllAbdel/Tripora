/**
 * Le passeport du voyageur : ce qu'on a fait avec Tripora, compté.
 *
 * Un voyage se prépare en quelques semaines et se vit en une ; entre deux, il
 * n'y a rien à ouvrir. Le passeport donne une raison de revenir qui ne doit
 * rien à une notification : les pays, les kilomètres, les tampons gagnés et
 * ceux qui restent à gagner.
 *
 * Rien n'y est déclaratif. Un voyage compte quand sa destination est arrêtée
 * et que ses dates exactes sont arrivées : « en juillet » ne prouve pas qu'on
 * soit parti, et un passeport qu'on remplit soi-même ne vaut rien. C'est
 * aussi ce qui en fera, le jour venu, une base honnête pour des points
 * échangeables : on ne récompense que ce qui s'est passé.
 */

import { continentDe, type Continent } from './continents.js';
import { haversineKm } from './geo.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/u;

export interface VoyageDuPasseport {
  id: string;
  titre: string;
  /** Code ISO du pays de la destination retenue ; `null` tant qu'elle ne l'est pas. */
  codePays: string | null;
  pays: string | null;
  ville: string | null;
  destination?: { lat: number; lng: number } | null;
  origine?: { lat: number; lng: number } | null;
  /** Dates exactes, `AAAA-MM-JJ`. */
  debut: string | null;
  fin: string | null;
  participants: number;
  organisateur: boolean;
}

export interface PaysVisite {
  code: string;
  nom: string;
  /** Combien de voyages y sont allés. */
  fois: number;
}

export interface Tampon {
  id: string;
  titre: string;
  detail: string;
  obtenu: boolean;
  /** Où l'on en est d'un tampon qui se compte : 3 pays sur 5. */
  progression?: { fait: number; objectif: number };
}

export interface Niveau {
  nom: string;
  /** Le nombre de pays qui l'ouvre. */
  seuil: number;
  suivant?: { nom: string; manque: number };
}

export interface Passeport {
  /** Les voyages commencés, du plus récent au plus ancien. */
  faits: VoyageDuPasseport[];
  /** Le prochain départ, s'il y en a un de daté. */
  prochain: { voyage: VoyageDuPasseport; dansJours: number } | null;
  pays: PaysVisite[];
  continents: Continent[];
  jours: number;
  /** Allers-retours à vol d'oiseau, depuis la ville de départ de chaque voyage. */
  kilometres: number;
  tampons: Tampon[];
  niveau: Niveau;
}

/** Les rangs, par nombre de pays. Le premier s'obtient sans être parti. */
const NIVEAUX: readonly { nom: string; seuil: number }[] = [
  { nom: 'Voyageur en herbe', seuil: 0 },
  { nom: 'Explorateur', seuil: 1 },
  { nom: 'Baroudeur', seuil: 3 },
  { nom: 'Grand voyageur', seuil: 6 },
  { nom: 'Globe-trotter', seuil: 12 },
  { nom: 'Légende', seuil: 25 },
];

/** La circonférence de la Terre à l'équateur, en kilomètres. */
export const TOUR_DU_MONDE_KM = 40_075;

function joursEntre(de: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

function date(voyage: VoyageDuPasseport): voyage is VoyageDuPasseport & { debut: string; fin: string } {
  return Boolean(voyage.debut && voyage.fin && DATE.test(voyage.debut) && DATE.test(voyage.fin) && voyage.fin >= voyage.debut);
}

function allerRetourKm(voyage: VoyageDuPasseport): number {
  if (!voyage.origine || !voyage.destination) return 0;
  return 2 * haversineKm(voyage.origine, voyage.destination);
}

function compte(id: string, titre: string, detail: string, fait: number, objectif: number): Tampon {
  return {
    id,
    titre,
    detail,
    obtenu: fait >= objectif,
    progression: { fait: Math.min(fait, objectif), objectif },
  };
}

function exploit(id: string, titre: string, detail: string, obtenu: boolean): Tampon {
  return { id, titre, detail, obtenu };
}

export function niveauPour(nombreDePays: number): Niveau {
  let rang = 0;
  NIVEAUX.forEach((niveau, index) => {
    if (nombreDePays >= niveau.seuil) rang = index;
  });
  const actuel = NIVEAUX[rang]!;
  const suivant = NIVEAUX[rang + 1];
  return {
    nom: actuel.nom,
    seuil: actuel.seuil,
    ...(suivant ? { suivant: { nom: suivant.nom, manque: suivant.seuil - nombreDePays } } : {}),
  };
}

/**
 * Le passeport, à la date du jour.
 *
 * Un voyage commencé compte déjà : le tampon se gagne à l'arrivée, pas au
 * retour.
 */
export function passeport(voyages: readonly VoyageDuPasseport[], aujourdhui: string): Passeport {
  const dates = voyages.filter(date);
  const faits = dates
    .filter((voyage) => voyage.codePays && voyage.debut <= aujourdhui)
    .sort((a, b) => b.debut.localeCompare(a.debut));

  const aVenir = dates
    .filter((voyage) => voyage.debut > aujourdhui)
    .sort((a, b) => a.debut.localeCompare(b.debut))[0];

  const parPays = new Map<string, PaysVisite>();
  for (const voyage of faits) {
    const code = voyage.codePays!.toUpperCase();
    const deja = parPays.get(code);
    if (deja) deja.fois += 1;
    else parPays.set(code, { code, nom: voyage.pays ?? code, fois: 1 });
  }
  const pays = [...parPays.values()].sort((a, b) => b.fois - a.fois || a.nom.localeCompare(b.nom, 'fr'));

  const continents = [...new Set(pays.map((entree) => continentDe(entree.code)).filter((c): c is Continent => Boolean(c)))];
  const jours = faits.reduce((total, voyage) => total + joursEntre(voyage.debut, voyage.fin) + 1, 0);
  const kilometres = Math.round(faits.reduce((total, voyage) => total + allerRetourKm(voyage), 0));
  const duree = (voyage: (typeof faits)[number]) => joursEntre(voyage.debut, voyage.fin) + 1;

  const tampons: Tampon[] = [
    compte('premier-depart', 'Premier départ', 'Un premier voyage vécu avec Tripora.', faits.length, 1),
    compte('habitue', 'Habitué', 'Cinq voyages vécus.', faits.length, 5),
    compte('cinq-pays', 'Cinq pays', 'Cinq pays différents.', pays.length, 5),
    compte('dix-pays', 'Dix pays', 'Dix pays différents.', pays.length, 10),
    compte('deux-continents', 'Deux continents', 'Des voyages sur deux continents.', continents.length, 2),
    compte('quatre-continents', 'Quatre continents', 'Des voyages sur quatre continents.', continents.length, 4),
    exploit(
      'long-courrier',
      'Long-courrier',
      'Un voyage à plus de 5 000 km de chez soi.',
      faits.some((voyage) => allerRetourKm(voyage) / 2 >= 5000),
    ),
    exploit('grande-tablee', 'Grande tablée', 'Un voyage à six ou plus.', faits.some((voyage) => voyage.participants >= 6)),
    exploit(
      'organisateur',
      'Organisateur',
      'Un voyage organisé par vous, et vécu.',
      faits.some((voyage) => voyage.organisateur),
    ),
    exploit('au-long-cours', 'Au long cours', 'Deux semaines d’affilée sur la route.', faits.some((voyage) => duree(voyage) >= 14)),
    exploit('week-end-eclair', 'Week-end éclair', 'Un voyage de trois jours ou moins.', faits.some((voyage) => duree(voyage) <= 3)),
    compte(
      'tour-du-monde',
      'Tour du monde',
      `${TOUR_DU_MONDE_KM.toLocaleString('fr-FR')} km parcourus, la circonférence de la Terre.`,
      kilometres,
      TOUR_DU_MONDE_KM,
    ),
  ];

  return {
    faits,
    prochain: aVenir ? { voyage: aVenir, dansJours: joursEntre(aujourdhui, aVenir.debut) } : null,
    pays,
    continents,
    jours,
    kilometres,
    tampons,
    niveau: niveauPour(pays.length),
  };
}
