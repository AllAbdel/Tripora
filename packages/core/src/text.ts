/**
 * Comparaison de texte tolérante, pour la recherche de villes.
 *
 * « seville », « Séville », « SEVILLE  » désignent la même ville, et personne
 * ne devrait avoir à taper l'accent au bon endroit pour trouver sa destination.
 * Trois écrans faisaient chacun leur propre version de ce pliage ; celle-ci est
 * la seule, pour qu'ils se comportent tous pareil.
 */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Vrai si `haystack` contient `needle`, accents et casse ignorés. */
export function foldedIncludes(haystack: string, needle: string): boolean {
  return fold(haystack).includes(fold(needle));
}
