import type { NomDePastille } from '@/components/Pastille';
import type { PoseDeLaMascotte } from '@/components/mascotte/Mascotte';

/**
 * Les arrêts de la visite guidée : le guide de démarrage, joué sur les vraies
 * pages plutôt qu'en diaporama.
 *
 * Chaque arrêt mène à un écran, y cherche un élément marqué
 * `data-guide="…"`, le met en lumière et l'explique dans une bulle. Les
 * textes reprennent ceux du diaporama (`etapesDuGuide.ts`), raccourcis : on
 * lit une bulle à côté de ce qu'elle désigne, pas une page.
 *
 * La visite se joue dans un voyage de la personne. Selon où il en est, tous
 * les arrêts n'ont pas de sens : « Découvrir » et l'itinéraire n'existent
 * qu'une fois la destination arrêtée, le vote seulement avant. Chaque arrêt
 * dit donc quand il s'applique, et la liste se calcule pour ce voyage-là.
 */

export interface ContexteDeLaVisite {
  /** Le voyage où se joue la visite ; `null` quand la personne n'en a aucun. */
  voyageId: string | null;
  destinationArretee: boolean;
  /** Vrai avec un serveur : on peut inviter, le groupe existe. */
  collaboration: boolean;
}

export interface ArretDeLaVisite {
  id: string;
  /** L'écran de l'arrêt. */
  chemin: (voyageId: string) => string;
  /**
   * Les valeurs de `data-guide` à chercher, dans l'ordre : la première
   * présente à l'écran est mise en lumière. Aucune : la bulle s'affiche au
   * milieu, sans projecteur.
   */
  cibles: readonly string[];
  titre: string;
  texte: string;
  /** Ce que fait le personnage (voir `docs/MASCOTTE.md`). */
  pose: PoseDeLaMascotte;
  /** Ce qu'il montre en attendant d'être dessiné. */
  pastille: NomDePastille;
  /** Quand l'arrêt s'applique. Absent : toujours. */
  quand?: (contexte: ContexteDeLaVisite) => boolean;
  /**
   * L'élément peut manquer pour de bonnes raisons (aucune destination ne
   * colle, donc rien à voter) : on passe alors l'arrêt au lieu d'expliquer
   * ce qui n'est pas là.
   */
  facultatif?: boolean;
  /**
   * Le bouton principal de cet arrêt, s'il fait autre chose qu'avancer.
   * `creer` : mène à la création d'un voyage, et la visite reprendra dedans.
   */
  action?: 'creer';
}

export const ARRETS_DE_LA_VISITE: readonly ArretDeLaVisite[] = [
  {
    id: 'premier-voyage',
    chemin: () => '/voyages',
    cibles: ['nouveau-voyage'],
    titre: 'Créez votre premier voyage',
    texte:
      'Avec qui, d’où, quand, pour combien : quelques écrans, et le voyage existe. Pas encore de destination ? Tripora la trouve avec le groupe. La visite reprendra dans votre voyage.',
    pose: 'accueil',
    pastille: 'creer',
    quand: (contexte) => contexte.voyageId === null,
    action: 'creer',
  },
  {
    id: 'nouveau',
    chemin: () => '/voyages',
    cibles: ['nouveau-voyage'],
    titre: 'Créez un voyage',
    texte:
      'Appuyez sur « Nouveau » : avec qui, d’où, quand, pour combien. Pas encore de destination ? Tripora la trouve avec le groupe.',
    pose: 'accueil',
    pastille: 'creer',
    quand: (contexte) => contexte.voyageId !== null,
  },
  {
    id: 'inviter',
    chemin: (voyageId) => `/voyages/${voyageId}/participants`,
    cibles: ['inviter'],
    titre: 'Invitez le groupe',
    texte: 'Envoyez le lien ou le code dans la conversation du groupe : on rejoint sans créer de compte.',
    pose: 'pointer',
    pastille: 'participants',
    quand: (contexte) => contexte.voyageId !== null && contexte.collaboration,
  },
  {
    id: 'envies',
    chemin: (voyageId) => `/voyages/${voyageId}`,
    cibles: ['prochain-geste'],
    titre: 'Chacun dit ses envies',
    texte:
      'Culture, nature, fête, détente, et le budget de chacun : Tripora propose les destinations qui conviennent au groupe entier. Cette carte dit toujours quoi faire ensuite.',
    pose: 'pointer',
    pastille: 'votes',
    quand: (contexte) => contexte.voyageId !== null && !contexte.destinationArretee,
  },
  {
    id: 'prochain-geste',
    chemin: (voyageId) => `/voyages/${voyageId}`,
    cibles: ['prochain-geste'],
    titre: 'Toujours le prochain geste',
    texte:
      'Cette carte dit quoi faire ensuite, selon où en est le groupe : remplir ses envies, composer le séjour, réserver. Tous les outils du voyage sont juste en dessous.',
    pose: 'pointer',
    pastille: 'accueil',
    quand: (contexte) => contexte.voyageId !== null && contexte.destinationArretee,
  },
  {
    id: 'voter',
    chemin: (voyageId) => `/voyages/${voyageId}`,
    cibles: ['vote'],
    titre: 'Le groupe vote',
    texte:
      'Chaque proposition affiche le vol depuis votre ville, le budget sur place et le climat du mois. Votez ; l’organisateur arrête la destination quand le groupe a tranché.',
    pose: 'pointer',
    pastille: 'votes',
    quand: (contexte) => contexte.voyageId !== null && !contexte.destinationArretee,
    facultatif: true,
  },
  {
    id: 'outils',
    chemin: (voyageId) => `/voyages/${voyageId}`,
    cibles: ['outils'],
    titre: 'Tous les outils du voyage',
    texte:
      'Sondages, réservations, discussion, carte… Une fois la destination arrêtée, Découvrir, l’itinéraire et la valise apparaissent ici aussi.',
    pose: 'explique',
    pastille: 'accueil',
    quand: (contexte) => contexte.voyageId !== null && !contexte.destinationArretee,
  },
  {
    id: 'decouvrir',
    chemin: (voyageId) => `/voyages/${voyageId}/decouvrir`,
    cibles: ['gestes-decouvrir'],
    titre: 'Les activités, d’un glissement',
    texte:
      'À droite : j’y vais. À gauche : pas pour moi. Ces boutons font la même chose. Le classement dit combien ont gardé chaque idée, jamais qui.',
    pose: 'pointer',
    pastille: 'decouvrir',
    quand: (contexte) => contexte.voyageId !== null && contexte.destinationArretee,
  },
  {
    id: 'itineraire',
    chemin: (voyageId) => `/voyages/${voyageId}/itineraire`,
    cibles: ['journees', 'construire-itineraire'],
    titre: 'Le programme se compose tout seul',
    texte:
      'Tripora range les activités qui ont plu jour par jour, au bon moment de la journée. Déplacez, remplacez ou ajoutez une étape : le groupe voit la même version.',
    pose: 'pointer',
    pastille: 'itineraire',
    quand: (contexte) => contexte.voyageId !== null && contexte.destinationArretee,
  },
  {
    id: 'coffre',
    chemin: (voyageId) => `/voyages/${voyageId}/coffre`,
    cibles: ['ajouter-info'],
    titre: 'Tout sous la main, même sans réseau',
    texte: 'Codes, wifi, adresses, billets : rangez-les dans le coffre. Ils restent lisibles hors connexion.',
    pose: 'explique',
    pastille: 'coffre',
    quand: (contexte) => contexte.voyageId !== null,
  },
  {
    id: 'depenses',
    chemin: (voyageId) => `/voyages/${voyageId}/budget`,
    cibles: ['ajouter-depense'],
    titre: 'Qui doit quoi, sans calculatrice',
    texte:
      'Chacun note ce qu’il paie, en toutes devises. À la fin, Tripora calcule les remboursements au plus simple.',
    pose: 'pointer',
    pastille: 'depenses',
    quand: (contexte) => contexte.voyageId !== null,
  },
];

/**
 * Les arrêts qui s'appliquent à ce voyage, dans l'ordre.
 *
 * Quand on est déjà dans le voyage — on vient de le créer, ou de le
 * rejoindre —, pas de « Nouveau » : repartir vers la liste pour montrer
 * comment créer ce qu'on a sous les yeux ferait perdre le fil.
 */
export function arretsPour(contexte: ContexteDeLaVisite, depart: { dansLeVoyage?: boolean } = {}): ArretDeLaVisite[] {
  return ARRETS_DE_LA_VISITE.filter(
    (arret) => (arret.quand?.(contexte) ?? true) && !(depart.dansLeVoyage && arret.id === 'nouveau'),
  );
}

/** Où commencer : à l'arrêt retenu s'il existe encore pour ce voyage, au début sinon. */
export function rangDeDepart(arrets: readonly ArretDeLaVisite[], depart: { arret?: string }): number {
  const rang = depart.arret ? arrets.findIndex((arret) => arret.id === depart.arret) : -1;
  return Math.max(rang, 0);
}

/** Le voyage où jouer la visite : de préférence un dont la destination est arrêtée, il a plus à montrer. */
export function voyageDeLaVisite(
  voyages: readonly { id: string; destinationId?: string | null }[],
): { voyageId: string | null; destinationArretee: boolean } {
  const arrete = voyages.find((voyage) => voyage.destinationId);
  const choisi = arrete ?? voyages[0];
  return { voyageId: choisi?.id ?? null, destinationArretee: Boolean(choisi?.destinationId) };
}
