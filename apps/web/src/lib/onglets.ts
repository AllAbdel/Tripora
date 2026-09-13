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
