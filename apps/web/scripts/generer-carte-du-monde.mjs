/**
 * Fabrique la carte du monde du passeport : une grille de points, chacun
 * rattaché au pays qu'il couvre.
 *
 *   node scripts/generer-carte-du-monde.mjs <ne_110m_admin_0_countries.geojson>
 *
 * Source : Natural Earth, pays au 1:110 000 000 (domaine public), à
 * télécharger depuis
 * https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson
 * Le fichier source (840 Ko) n'est pas versionné ; seul le résultat l'est, et
 * il pèse une quinzaine de kilo-octets.
 *
 * Une grille plutôt que des contours : une carte en points se dessine d'un
 * seul tracé SVG, pèse cinquante fois moins que les frontières, et colorer un
 * pays visité revient à colorer ses points. Les très petits pays (Malte,
 * Singapour, les Maldives…) n'ont pas de point à cette échelle : le passeport
 * les marque d'une épingle à l'endroit du voyage.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SORTIE = resolve(HERE, '../src/lib/carteDuMonde.donnees.ts');

/** Deux degrés par point ; de 84° N à 58° S (l'Antarctique n'est le voyage de personne ici). */
const PAS = 2;
const NORD = 84;
const SUD = -58;
const COLONNES = 360 / PAS;
const LIGNES = (NORD - SUD) / PAS;

/** Les territoires sans code ISO dans Natural Earth, rattachés à leur pays. */
const RATTACHEMENTS = { 'N. Cyprus': 'CY', Somaliland: 'SO' };

function codeDe(proprietes) {
  const code = proprietes.ISO_A2_EH !== '-99' ? proprietes.ISO_A2_EH : proprietes.ISO_A2;
  if (code && code !== '-99') return code;
  return RATTACHEMENTS[proprietes.NAME] ?? null;
}

/** Pair-impair sur tous les anneaux : les trous (lacs, enclaves) sont exclus. */
function contient(anneaux, lng, lat) {
  let dedans = false;
  for (const anneau of anneaux) {
    for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
      const [xi, yi] = anneau[i];
      const [xj, yj] = anneau[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
    }
  }
  return dedans;
}

const source = process.argv[2];
if (!source) {
  console.error('Usage : node scripts/generer-carte-du-monde.mjs <ne_110m_admin_0_countries.geojson>');
  process.exit(1);
}

const pays = JSON.parse(readFileSync(source, 'utf8'))
  .features.map((entite) => {
    const code = codeDe(entite.properties);
    const polygones =
      entite.geometry.type === 'Polygon' ? [entite.geometry.coordinates] : entite.geometry.coordinates;
    return { code, polygones, boite: entite.bbox };
  })
  .filter((entree) => entree.code);

const grille = [];
for (let ligne = 0; ligne < LIGNES; ligne++) {
  const lat = NORD - (ligne + 0.5) * PAS;
  const rangee = [];
  for (let colonne = 0; colonne < COLONNES; colonne++) {
    const lng = -180 + (colonne + 0.5) * PAS;
    let trouve = '..';
    for (const { code, polygones, boite } of pays) {
      if (boite && (lng < boite[0] || lng > boite[2] || lat < boite[1] || lat > boite[3])) continue;
      if (polygones.some((anneaux) => contient(anneaux, lng, lat))) {
        trouve = code;
        break;
      }
    }
    rangee.push(trouve);
  }
  grille.push(rangee);
}

// Chaque ligne en suites « code × nombre » : « ..12FR3..4 ».
const lignesCodees = grille.map((rangee) => {
  let texte = '';
  let precedent = rangee[0];
  let nombre = 0;
  for (const code of [...rangee, null]) {
    if (code === precedent) {
      nombre++;
      continue;
    }
    texte += `${precedent}${nombre}`;
    precedent = code;
    nombre = 1;
  }
  return texte;
});

const points = grille.flat().filter((code) => code !== '..').length;
const contenu = `/**
 * La carte du monde du passeport, en points de ${PAS}° : généré par
 * \`scripts/generer-carte-du-monde.mjs\` depuis Natural Earth (domaine public).
 * Ne pas modifier à la main.
 *
 * Une ligne par parallèle, du nord au sud ; chaque ligne en suites « code du
 * pays, nombre de points » (« .. » pour la mer).
 */

export const PAS = ${PAS};
export const NORD = ${NORD};
export const SUD = ${SUD};
export const COLONNES = ${COLONNES};
export const LIGNES = ${LIGNES};

/** ${points} points de terre. */
export const GRILLE: readonly string[] = ${JSON.stringify(lignesCodees, null, 2)};
`;
writeFileSync(SORTIE, contenu);
console.log(`${points} points de terre, ${pays.length} pays, ${(contenu.length / 1024).toFixed(1)} Ko → ${SORTIE}`);
