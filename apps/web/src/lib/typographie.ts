/**
 * Les espaces insécables du français.
 *
 * Un guillemet ou un point d'interrogation seul en début de ligne se remarque
 * tout de suite — « Non merci » coupé après le guillemet ouvrant, « où »
 * séparé de son « ? ». Le navigateur ne peut pas le deviner : c'est à
 * l'espace d'interdire la coupure. On les pose ici plutôt qu'à la main dans
 * chaque texte, où l'on finit toujours par en oublier une.
 */
export function insecables(texte: string): string {
  return texte
    .replace(/« /gu, '« ')
    .replace(/ »/gu, ' »')
    .replace(/ ([?!:;])/gu, ' $1');
}
