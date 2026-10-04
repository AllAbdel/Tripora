/**
 * Repeindre le fond de carte aux couleurs du carnet.
 *
 * Le reste de l'application est en papier tiède et encre brune ; la carte, elle,
 * arrivait en gris bleuté sur blanc pur — le fond « positron », qu'on trouve sur
 * la moitié des sites du monde. Ce n'est pas laid, c'est *anonyme* : elle disait
 * « voici une carte », pas « voici votre carnet ».
 *
 * On ne réécrit pas le style : un fond de carte, ce sont cent cinquante couches
 * empilées, et les maintenir reviendrait à maintenir un atlas. On garde donc
 * celui d'OpenFreeMap, et on **repeint** ses couches une par une une fois
 * chargées, en les rangeant par rôle.
 *
 * Le classement se fait sur l'identifiant de la couche, parce que c'est la
 * seule chose stable entre les styles : `water`, `landuse-park`,
 * `building-top`, `road_major_motorway`. Il est volontairement isolé du reste
 * et testé — si l'amont renomme ses couches, c'est ici qu'on s'en aperçoit.
 *
 * Trois partis pris :
 *
 *  - **la terre est du papier**, pas du blanc. C'est ce qui raccorde la carte à
 *    la page autour d'elle, et c'est le changement qui compte le plus ;
 *  - **l'eau est une encre diluée**, pas un aplat bleu de navigateur GPS ;
 *  - **les routes sont des filets.** Un réseau routier en blanc épais avec un
 *    liseré gris est la signature visuelle d'une carte de navigation ; on ne
 *    navigue pas ici, on repère des lieux.
 */

export type RoleDeCouche =
  | 'fond'
  | 'terre'
  | 'eau'
  | 'vegetation'
  | 'batiment'
  | 'route'
  | 'rail'
  | 'frontiere'
  | 'etiquette'
  | 'autre';

/**
 * À quoi sert cette couche, d'après son identifiant.
 *
 * L'ordre compte : « water-name » est une étiquette avant d'être de l'eau, et
 * « road-label » une étiquette avant d'être une route. Les libellés passent
 * donc en premier.
 */
export function roleDeLaCouche(id: string, type: string): RoleDeCouche {
  const nom = id.toLowerCase();

  if (type === 'symbol' || nom.includes('label') || nom.includes('-name') || nom.includes('_name')) {
    return 'etiquette';
  }
  if (type === 'background') return 'fond';
  if (nom.includes('water') || nom.includes('ocean') || nom.includes('river')) return 'eau';
  if (
    nom.includes('park') ||
    nom.includes('wood') ||
    nom.includes('forest') ||
    nom.includes('grass') ||
    nom.includes('green') ||
    nom.includes('garden') ||
    nom.includes('pitch') ||
    nom.includes('cemetery')
  ) {
    return 'vegetation';
  }
  if (nom.includes('building')) return 'batiment';
  if (nom.includes('rail') || nom.includes('transit')) return 'rail';
  if (nom.includes('boundary') || nom.includes('admin')) return 'frontiere';
  if (nom.includes('road') || nom.includes('highway') || nom.includes('street') || nom.includes('bridge') || nom.includes('tunnel')) {
    return 'route';
  }
  if (nom.includes('landcover') || nom.includes('landuse') || nom.includes('earth') || nom.includes('land')) {
    return 'terre';
  }
  return 'autre';
}

/** Une palette complète, pour un thème. */
export interface PaletteDeCarte {
  fond: string;
  terre: string;
  eau: string;
  vegetation: string;
  batiment: string;
  batimentContour: string;
  route: string;
  routeContour: string;
  rail: string;
  frontiere: string;
  texte: string;
  halo: string;
}

/**
 * Les deux palettes.
 *
 * Elles reprennent exactement les jetons de l'interface — le papier
 * (`#f4efe4`), l'encre (`#1a1713`), le brun sourd des filets — pour que la
 * carte ne soit pas « assortie » à la page mais faite de la même matière.
 */
export const PALETTES: Record<'clair' | 'sombre', PaletteDeCarte> = {
  clair: {
    fond: '#f4efe4',
    terre: '#f1ebdf',
    // Une encre diluée, pas un bleu d'écran : elle a la même température que
    // le papier, ce qui la fait tenir dans la page.
    eau: '#c9d6d9',
    vegetation: '#e2e6d4',
    batiment: '#e8e1d2',
    batimentContour: '#ddd4c2',
    route: '#fffdf8',
    routeContour: '#e0d8c8',
    rail: '#d8cfbd',
    frontiere: '#b9ab94',
    texte: '#4a4137',
    halo: '#f4efe4',
  },
  sombre: {
    fond: '#131110',
    terre: '#171513',
    eau: '#1f2729',
    vegetation: '#1c201a',
    batiment: '#201d19',
    batimentContour: '#2a251f',
    route: '#2b2620',
    routeContour: '#201c17',
    rail: '#2a251f',
    frontiere: '#3d362c',
    texte: '#b8ab99',
    halo: '#131110',
  },
};

/** Ce qu'il faut peindre sur une couche : la propriété, et la couleur. */
export interface Retouche {
  propriete: string;
  valeur: string | number;
}

/**
 * Les retouches d'une couche, selon son rôle et son type.
 *
 * Pure et testable : elle ne connaît ni MapLibre ni le réseau. La boucle qui
 * l'applique, elle, tient en dix lignes et n'a rien à décider.
 */
export function retouchesPour(
  role: RoleDeCouche,
  type: string,
  palette: PaletteDeCarte,
): Retouche[] {
  switch (role) {
    case 'fond':
      // Le type est vérifié ici et pas seulement chez l'appelant : poser
      // `background-color` sur une couche de remplissage fait lever MapLibre,
      // et la carte reste blanche sans que rien ne le dise.
      return type === 'background'
        ? [{ propriete: 'background-color', valeur: palette.fond }]
        : [];
    case 'terre':
      return type === 'fill' ? [{ propriete: 'fill-color', valeur: palette.terre }] : [];
    case 'eau':
      if (type === 'fill') return [{ propriete: 'fill-color', valeur: palette.eau }];
      if (type === 'line') return [{ propriete: 'line-color', valeur: palette.eau }];
      return [];
    case 'vegetation':
      return type === 'fill' ? [{ propriete: 'fill-color', valeur: palette.vegetation }] : [];
    case 'batiment':
      // Les bâtiments s'effacent presque : à l'échelle où l'on regarde une
      // ville, ils font un bruit de fond gris qui mange tout le reste.
      if (type === 'fill') {
        return [
          { propriete: 'fill-color', valeur: palette.batiment },
          { propriete: 'fill-outline-color', valeur: palette.batimentContour },
          { propriete: 'fill-opacity', valeur: 0.55 },
        ];
      }
      return [];
    case 'route':
      // Un filet, pas un ruban : le trait blanc épais souligné de gris est la
      // signature d'une carte de navigation, et on ne navigue pas ici.
      if (type === 'line') {
        return [
          { propriete: 'line-color', valeur: palette.route },
          { propriete: 'line-opacity', valeur: 0.9 },
        ];
      }
      if (type === 'fill') return [{ propriete: 'fill-color', valeur: palette.routeContour }];
      return [];
    case 'rail':
      return type === 'line' ? [{ propriete: 'line-color', valeur: palette.rail }] : [];
    case 'frontiere':
      return type === 'line'
        ? [
            { propriete: 'line-color', valeur: palette.frontiere },
            { propriete: 'line-opacity', valeur: 0.5 },
          ]
        : [];
    case 'etiquette':
      // La police reste celle du style : les glyphes sont servis par
      // OpenFreeMap, et Fraunces n'y est pas. On agit sur ce qu'on peut —
      // la couleur de l'encre et le halo, qui est la couleur du papier.
      return type === 'symbol'
        ? [
            { propriete: 'text-color', valeur: palette.texte },
            { propriete: 'text-halo-color', valeur: palette.halo },
            { propriete: 'text-halo-width', valeur: 1.2 },
          ]
        : [];
    default:
      return [];
  }
}
