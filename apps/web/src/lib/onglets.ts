import type { NomDePastille } from '@/components/Pastille';

/**
 * Quel onglet de la barre de navigation une adresse représente.
 *
 * `/carte` et `/budget` se prolongent à l'intérieur d'un voyage précis —
 * `/voyages/v1/carte`, `/voyages/v1/budget` — pour qu'ouvrir l'onglet Carte
 * sans avoir choisi de voyage retrouve le seul qui existe. Sans ce cas
 * particulier, ces deux adresses commencent par `/voyages/`, et la barre
 * gardait « Voyages » allumé quoi qu'on ouvre : on pouvait taper sur Carte ou
 * sur Budget, l'onglet actif ne bougeait jamais.
 */
/** Les écrans qu'on ouvre depuis le profil, et qui en gardent l'onglet. */
const ECRANS_DU_PROFIL = ['/passeport', '/soutenir', '/confidentialite'];

export function ongletActif(chemin: string, pathname: string): boolean {
  if (pathname === chemin) return true;
  if (chemin === '/profil' && ECRANS_DU_PROFIL.includes(pathname)) return true;
  if (chemin === '/voyages') {
    return (
      pathname.startsWith('/voyages/') &&
      !pathname.endsWith('/carte') &&
      !pathname.endsWith('/budget')
    );
  }
  return pathname.endsWith(chemin);
}

/**
 * Le voyage qu'une adresse désigne, ou `null`.
 *
 * Sur grand écran, la barre latérale liste les écrans du voyage ouvert : il
 * faut donc savoir, de n'importe quelle adresse, de quel voyage il s'agit.
 * « /voyages/nouveau » est l'assistant de création, pas un voyage.
 */
export function voyageDeLAdresse(pathname: string): string | null {
  const trouve = /^\/voyages\/([^/]+)/u.exec(pathname);
  if (!trouve?.[1] || trouve[1] === 'nouveau') return null;
  return decodeURIComponent(trouve[1]);
}

/**
 * Un écran où l'on écrit en continu, et où la barre d'onglets n'a pas sa
 * place : la discussion du groupe.
 *
 * Sa barre de saisie est fixée en bas, là même où vivent les onglets — ils la
 * recouvraient, et l'on ne pouvait plus écrire. Comme dans toute messagerie,
 * la conversation prend le bas de l'écran ; on en sort par le retour, en haut.
 */
export function ecranDeConversation(pathname: string): boolean {
  return /^\/voyages\/[^/]+\/discussion\/?$/u.test(pathname);
}

/**
 * Les écrans sans onglets en bas : la discussion, et « Découvrir », qui prend
 * tout l'écran — ses boutons occupent le bas, là où vivent les onglets.
 */
export function ecranSansOnglets(pathname: string): boolean {
  return ecranDeConversation(pathname) || /^\/voyages\/[^/]+\/decouvrir\/?$/u.test(pathname);
}

export interface SectionDuVoyage {
  to: string;
  titre: string;
  pastille: NomDePastille;
}

/**
 * Les écrans d'un voyage, dans l'ordre où on s'en sert.
 *
 * Les mêmes que la grille de l'aperçu, avec la même règle : ce qui suppose
 * une destination arrêtée — quoi faire sur place, les journées, la valise —
 * n'apparaît qu'une fois qu'elle l'est.
 */
export function sectionsDuVoyage(id: string, destinationVerrouillee: boolean): SectionDuVoyage[] {
  const base = `/voyages/${encodeURIComponent(id)}`;
  const sections: (SectionDuVoyage | false)[] = [
    { to: base, titre: 'Aperçu', pastille: 'accueil' },
    destinationVerrouillee && { to: `${base}/decouvrir`, titre: 'Découvrir', pastille: 'decouvrir' },
    destinationVerrouillee && { to: `${base}/a-faire`, titre: 'À faire', pastille: 'meteo' },
    destinationVerrouillee && { to: `${base}/itineraire`, titre: 'Itinéraire', pastille: 'itineraire' },
    { to: `${base}/reservations`, titre: 'Réservations', pastille: 'hebergements' },
    { to: `${base}/qui-fait-quoi`, titre: 'Qui fait quoi', pastille: 'taches' },
    { to: `${base}/coffre`, titre: 'Coffre', pastille: 'coffre' },
    { to: `${base}/carte`, titre: 'Carte', pastille: 'carte' },
    { to: `${base}/budget`, titre: 'Dépenses', pastille: 'depenses' },
    { to: `${base}/discussion`, titre: 'Discussion', pastille: 'discussion' },
    { to: `${base}/sondages`, titre: 'Sondages', pastille: 'sondages' },
    { to: `${base}/participants`, titre: 'Participants', pastille: 'participants' },
    destinationVerrouillee && { to: `${base}/valise`, titre: 'Ma valise', pastille: 'valise' },
    { to: `${base}/recapitulatif`, titre: 'Récapitulatif', pastille: 'recapitulatif' },
  ];
  return sections.filter((section): section is SectionDuVoyage => section !== false);
}
