/**
 * Les décisions de la couverture, isolées de tout appel réseau.
 *
 * Ces cinq fonctions sont l'endroit où l'on s'est trompé à chaque fois :
 * Lisbonne illustrée par son drapeau municipal, Cambridge par Westminster,
 * Sumatra par un atlas de 1900, Gibraltar par une image satellite de la NASA.
 * Aucune de ces erreurs ne venait du réseau — toutes venaient d'un choix fait
 * ici, sur un nom de fichier ou un titre d'article.
 *
 * Elles vivent donc dans leur propre module, sans dépendance, pour être
 * exécutables et testables hors ligne :
 *
 *   deno test supabase/functions/cover/choix.test.ts
 */

/**
 * Le nom d'article probable, tiré du nom du catalogue.
 *
 * Une bonne partie des entrées ne sont pas des noms de ville mais des
 * intitulés : « Caen et les plages du Débarquement », « Ålesund et le
 * Geirangerfjord », « Sumatra — Medan et le lac Toba ». Aucun titre
 * d'article ne leur ressemblera jamais. On garde donc ce qui précède le
 * premier séparateur — c'est toujours le lieu principal, par construction du
 * catalogue.
 *
 * La coupe se fait sur « et » quelle que soit la casse de ce qui suit :
 * « Abidjan et Assinie » doit donner « Abidjan » aussi sûrement que « Caen et
 * les plages du Débarquement » donne « Caen ». Sur les trente-cinq entrées du
 * catalogue construites ainsi, la première moitié est chaque fois le lieu qui
 * porte l'article.
 *
 * Le nom complet reste utilisé pour la recherche : le contexte qu'il apporte
 * aide à départager les homonymes.
 */
export function nomCourt(nom: string): string {
  const coupe = nom.split(/\s+[—–-]\s+| et |,/u)[0]?.trim() ?? nom;
  // En dessous de trois lettres, la coupe a mal tourné : on garde l'original.
  const garde = coupe.length >= 3 ? coupe : nom;
  // « Les Sundarbans » s'écrit « Sundarbans » sur Wikipédia, comme la plupart
  // des massifs et des archipels. On tente la forme sans article.
  return garde.replace(/^(?:les|la|le|l')\s*/iu, '') || garde;
}
/** Sans accents, sans casse, sans ponctuation : la forme comparable d'un nom. */
export function plier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
/**
 * L'article trouvé parle-t-il bien de la ville cherchée ?
 *
 * On accepte le titre exact et le titre suivi d'une précision entre
 * parenthèses — « Cambridge (Massachusetts) » est bien un Cambridge. On refuse
 * tout le reste, y compris un article qui ne ferait que contenir le nom :
 * « Université de Cambridge » n'est pas une ville, et « Royaume-Uni » encore
 * moins.
 */
export function titreCorrespond(titre: string | undefined, nom: string): boolean {
  if (!titre) return false;
  const cherche = plier(nom);
  const trouve = plier(titre);
  if (cherche.length === 0) return false;
  return trouve === cherche || trouve.startsWith(`${cherche} `);
}
/** Les mots qui trahissent un emblème ou une carte plutôt qu'une photo. */
const PAS_UNE_PHOTO =
  /(flag|bandeira|bandera|drapeau|coat[ _]of[ _]arms|wappen|blason|bras[aã]o|escudo|seal|logo|\bmap\b|\bmapa\b|\bcarte\b|atlas|topograph|relief|orthographic|localisation|location)/i;

/**
 * Les images prises depuis l'orbite, qui sont des photographies sans être des
 * vues du lieu.
 *
 * Elles passent tous les filtres précédents : ce sont de vrais JPEG, sans
 * aucun mot d'emblème. Et pourtant Gibraltar illustré par une image NASA du
 * détroit, Mayotte par une prise de vue Sentinel et Saint-Pierre-et-Miquelon
 * par une photo de la Station spatiale ne montrent au voyageur rien de ce
 * qu'il verra sur place.
 *
 * Deux signaux suffisent : le nom du programme spatial — collé au reste du
 * titre s'il le faut, « FromTheISS » n'ayant aucune frontière de mot — et
 * les coordonnées
 * décimales dans le nom du fichier — « Strait of Gibraltar 5.53940W
 * 35.97279N.jpg » est un identifiant de prise de vue, pas un titre de photo.
 */
const VUE_DEPUIS_L_ESPACE =
  /(satellite|sentinel[ _-]?[0-9]?|landsat|\biss\b|from[ _]?the[ _]?iss|\biss[0-9]{2,3}\b|station spatiale|space station|from space|depuis l'espace|copernicus|modis|astronaut|spot[ _-]?[567]\b|[0-9]+\.[0-9]+ ?[we][ _][0-9]+\.[0-9]+ ?[ns])/i;

/**
 * Une photo, ou autre chose ?
 *
 * Le format fait le gros du tri, et il le fait mieux que n'importe quelle
 * liste de mots : sur Commons, les photographies sont en JPEG et les cartes,
 * schémas et blasons en PNG ou en SVG. Une image vectorielle n'est jamais une
 * ville.
 *
 * Le PNG reste accepté sous condition, parce que quelques vraies photos y sont
 * — celle de Lisbonne, par exemple. Il passe alors par la liste de mots, qui
 * écarte les cartes topographiques et les blasons.
 *
 * Une dernière règle vise les photos d'agence, que Wikidata désigne parfois
 * comme image d'une ville. Celle d'Ouidah était intitulée « Africa Endeavor is
 * empowering African Partner nations to enhance their C4 (command, control,
 * communications and computer systems) and cyber defense capabilities in
 * Cotonou, Benin in July 2025 - 94.jpg » : un exercice militaire, dans une
 * autre ville, sous un nom de deux cent trente caractères. Aucun mot-clé ne
 * l'attrape ; sa longueur, si. Un nom de fichier aussi long est une légende de
 * dépêche, jamais le titre d'une photo de lieu.
 *
 * Rien de tout ça n'est infaillible : pour une île ou une région, Wikipédia
 * illustre parfois avec une carte, et aucun filtre ne rattrapera tous les cas.
 * L'écran a un fond de repli pour ceux-là.
 */
/**
 * Un nom de fichier au-delà de cette longueur n'est plus un titre : c'est une
 * légende. Le plus long nom retenu sur cent villes fait quatre-vingt-dix
 * caractères ; celui qui illustrait Ouidah en faisait deux cent trente.
 */
const LONGUEUR_D_UNE_LEGENDE = 150;

export function estUnEmbleme(fichier: string | undefined): boolean {
  if (!fichier) return true;
  if (fichier.length > LONGUEUR_D_UNE_LEGENDE) return true;
  if (VUE_DEPUIS_L_ESPACE.test(fichier)) return true;
  if (/\.jpe?g$/i.test(fichier)) return PAS_UNE_PHOTO.test(fichier);
  if (/\.png$/i.test(fichier)) return PAS_UNE_PHOTO.test(fichier);
  // Tout le reste — SVG, GIF, TIFF — n'est pas une photographie de ville.
  return true;
}
/**
 * Le crédit arrive en HTML — Commons y met des liens, des balises et parfois
 * une mise en page entière. On n'en garde que le texte, parce que rien de tout
 * cela ne sera jamais interprété comme du HTML côté client : la règle du projet
 * est qu'aucune chaîne venue du réseau ne devient du balisage.
 */
export function texteBrut(html: string | undefined): string | null {
  if (!html) return null;
  const texte = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (texte.length === 0) return null;
  // Un crédit de trois lignes ne tient pas sous une image ; au-delà, on
  // renvoie vers la page du fichier, qui porte la mention complète.
  return texte.length > 120 ? `${texte.slice(0, 117)}…` : texte;
}
