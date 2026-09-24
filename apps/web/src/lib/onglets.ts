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
export function ongletActif(chemin: string, pathname: string): boolean {
  if (pathname === chemin) return true;
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
    destinationVerrouillee && { to: `${base}/a-faire`, titre: 'À faire', pastille: 'meteo' },
    destinationVerrouillee && { to: `${base}/itineraire`, titre: 'Itinéraire', pastille: 'itineraire' },
    { to: `${base}/carte`, titre: 'Carte', pastille: 'carte' },
    { to: `${base}/budget`, titre: 'Dépenses', pastille: 'depenses' },
    { to: `${base}/discussion`, titre: 'Discussion', pastille: 'discussion' },
    { to: `${base}/participants`, titre: 'Participants', pastille: 'participants' },
    destinationVerrouillee && { to: `${base}/valise`, titre: 'Ma valise', pastille: 'valise' },
    { to: `${base}/recapitulatif`, titre: 'Récapitulatif', pastille: 'recapitulatif' },
  ];
  return sections.filter((section): section is SectionDuVoyage => section !== false);
}
