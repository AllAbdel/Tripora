import { DESTINATIONS, findDestination } from '@tripora/core';

/**
 * Le titre d'un voyage, tenu à jour quand c'est Tripora qui l'a composé.
 *
 * À la création, personne n'écrit de titre : Tripora propose « Lisbonne à 4 »
 * d'après la première destination choisie et la taille du groupe
 * (`suggestTitle`). Mais le groupe peut ensuite arrêter une autre destination
 * de la liste, ou s'agrandir : la carte disait alors « Lisbonne à 1 » sous
 * un grand « Bordeaux ». Un titre de cette forme, qui nomme une destination
 * connue, suit donc la destination arrêtée et le nombre de participants.
 *
 * Un titre écrit par la personne (« Week-end entre filles », « EVG de Max »)
 * ne ressemble pas à cette forme, ou ne nomme pas une destination : il reste
 * tel quel.
 */

/** La forme des titres proposés : un nom de lieu, « à », un nombre. */
const TITRE_PROPOSE = /^(\p{Lu}[^·,:\d]*) à (\d+)$/u;

let parNom: Map<string, string> | null = null;

/** Les destinations du catalogue, par nom français : construit au premier besoin. */
function destinationNommee(nom: string): string | undefined {
  parNom ??= new Map(DESTINATIONS.map((destination) => [destination.name, destination.id]));
  return parNom.get(nom);
}

/** Vrai pour un titre composé par Tripora, qui suit donc la destination et le groupe. */
export function estUnTitrePropose(titre: string): boolean {
  const propose = TITRE_PROPOSE.exec(titre.trim());
  return Boolean(propose && destinationNommee(propose[1]!.trim()));
}

export function titreDuVoyage(
  titre: string,
  { destinationId, participants }: { destinationId?: string | null; participants?: number | null },
): string {
  const propose = TITRE_PROPOSE.exec(titre.trim());
  if (!propose) return titre;
  const nommee = destinationNommee(propose[1]!.trim());
  // Pas un lieu du catalogue : c'est la personne qui l'a écrit.
  if (!nommee) return titre;
  const retenue = destinationId ? findDestination(destinationId)?.name : undefined;
  const nombre = participants && participants > 0 ? participants : Number(propose[2]);
  return `${retenue ?? propose[1]!.trim()} à ${nombre}`;
}
