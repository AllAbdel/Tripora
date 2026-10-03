/**
 * Le journal photo du voyage : les photos de chacun, rangées par jour.
 *
 * Ce module ne connaît ni le stockage ni l'écran : il dit à quel jour une
 * photo appartient, et comment titrer ce jour — « Jour 3 · mardi 12 mai »
 * pendant le séjour, la date seule avant ou après.
 */
import { localeActive } from './regional.js';

export interface PhotoDuVoyage {
  id: string;
  tripId: string;
  /** La photo, « <voyage>/<id>.jpg ». */
  chemin: string;
  /** Sa vignette, « <voyage>/<id>.mini.jpg ». */
  cheminMini: string;
  legende: string | null;
  /** Quand elle a été prise, d'après le téléphone ; `null` si on l'ignore. */
  priseLe: string | null;
  largeur: number | null;
  hauteur: number | null;
  /** En octets. */
  taille: number | null;
  ajoutePar: string | null;
  ajouteLe: string;
}

/** Les plafonds, les mêmes que ceux de la base (migration du journal photo). */
export const LIMITES_DU_JOURNAL = {
  parVoyage: 300,
  parPersonneOctets: 80 * 1024 * 1024,
  /** Le côté le plus long d'une photo envoyée, et de sa vignette. */
  cotePhoto: 1600,
  coteVignette: 480,
} as const;

export const LONGUEUR_MAX_DE_LEGENDE = 280;

/**
 * Le jour d'une photo (AAAA-MM-JJ), à l'heure du lieu du voyage quand on la
 * connaît : une photo prise à 23 h à Bali appartient à ce jour-là à Bali,
 * pas au lendemain de Paris.
 */
export function jourDeLaPhoto(photo: Pick<PhotoDuVoyage, 'priseLe' | 'ajouteLe'>, fuseau?: string): string {
  const instant = new Date(photo.priseLe ?? photo.ajouteLe);
  try {
    // « sv-SE » écrit les dates en AAAA-MM-JJ.
    return instant.toLocaleDateString('sv-SE', fuseau ? { timeZone: fuseau } : {});
  } catch {
    return instant.toLocaleDateString('sv-SE');
  }
}

function joursEntre(debut: string, fin: string): number {
  return Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000);
}

function dateLisible(jour: string, avecAnnee: boolean): string {
  return new Date(`${jour}T12:00:00Z`).toLocaleDateString(localeActive(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(avecAnnee ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
}

export interface JourDuJournal {
  jour: string;
  titre: string;
  photos: PhotoDuVoyage[];
}

/**
 * Les photos regroupées par jour, du premier au dernier : un journal se lit
 * dans l'ordre du voyage. Pendant le séjour, chaque jour porte son numéro.
 */
export function regrouperParJour(
  photos: readonly PhotoDuVoyage[],
  { debut, fin, fuseau }: { debut?: string | null; fin?: string | null; fuseau?: string } = {},
): JourDuJournal[] {
  const parJour = new Map<string, PhotoDuVoyage[]>();
  for (const photo of photos) {
    const jour = jourDeLaPhoto(photo, fuseau);
    parJour.set(jour, [...(parJour.get(jour) ?? []), photo]);
  }
  const annees = new Set([...parJour.keys()].map((jour) => jour.slice(0, 4)));
  const anneeCourante = String(new Date().getFullYear());
  const avecAnnee = annees.size > 1 || !annees.has(anneeCourante);

  return [...parJour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jour, dansLeJour]) => {
      const date = dateLisible(jour, avecAnnee);
      const pendant = debut && fin && jour >= debut && jour <= fin;
      return {
        jour,
        titre: pendant ? `Jour ${joursEntre(debut, jour) + 1} · ${date}` : date.charAt(0).toUpperCase() + date.slice(1),
        photos: [...dansLeJour].sort((a, b) =>
          (a.priseLe ?? a.ajouteLe).localeCompare(b.priseLe ?? b.ajouteLe),
        ),
      };
    });
}

/**
 * La date de prise de vue qu'on retient d'un fichier : sa date de
 * modification, que l'appareil photo pose au moment du déclenchement. Elle
 * n'est gardée que si elle est plausible — ni dans le futur, ni avant 2000
 * (une horloge remise à zéro).
 */
export function priseDeVuePlausible(dernierChangement: number | undefined, maintenant = Date.now()): string | null {
  if (!dernierChangement || !Number.isFinite(dernierChangement)) return null;
  if (dernierChangement > maintenant + 86_400_000 || dernierChangement < Date.UTC(2000, 0, 1)) return null;
  return new Date(dernierChangement).toISOString();
}

export function problemeDeLegende(legende: string): string | null {
  return legende.trim().length > LONGUEUR_MAX_DE_LEGENDE
    ? `Une légende tient en ${LONGUEUR_MAX_DE_LEGENDE} caractères.`
    : null;
}
