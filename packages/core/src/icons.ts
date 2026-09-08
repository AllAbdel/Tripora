/**
 * Les noms d'icônes que le noyau peut désigner.
 *
 * Le noyau ne connaît ni React ni aucune bibliothèque graphique : il nomme une
 * icône, l'interface la dessine. Ce détour existe pour une raison précise —
 * **Tripora n'affiche jamais d'émoji.**
 *
 * Un émoji n'est pas une icône : son dessin change à chaque système (le même
 * caractère est une image chez Apple, un pictogramme plat chez Google, parfois
 * rien du tout sous Windows), sa taille ne suit pas celle du texte, sa couleur
 * échappe au thème, et les drapeaux ne s'affichent tout simplement pas sur une
 * grande partie du parc. Une interface qui en dépend n'a pas de direction
 * artistique : elle en emprunte une différente à chaque appareil.
 *
 * Le type ci-dessous liste donc les seuls noms utilisables, et l'interface
 * garantit à la compilation qu'elle sait tous les dessiner.
 */
export type NomIcone =
  // Envies
  | 'culture'
  | 'nature'
  | 'gastronomie'
  | 'fete'
  | 'detente'
  | 'aventure'
  | 'shopping'
  | 'insolite'
  // Ciel
  | 'soleil'
  | 'eclaircies'
  | 'nuages'
  | 'brouillard'
  | 'pluie'
  | 'neige'
  | 'orage'
  // Dépenses et journée
  | 'transport'
  | 'hebergement'
  | 'billet'
  | 'divers'
  | 'avion'
  | 'arrivee'
  | 'depart'
  | 'repas'
  | 'soiree'
  | 'lieu'
  // Valise
  | 'papiers'
  | 'vetements'
  | 'chaussures'
  | 'toilette'
  | 'sante'
  | 'electronique';
