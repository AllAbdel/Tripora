/**
 * Les icônes et l'écran de lancement des applications Android et iOS.
 *
 *   pnpm --filter @tripora/mobile ressources
 *
 * Même source et même méthode que les icônes du site
 * (`apps/web/scripts/generate-icons.mjs`) : l'icône d'origine, rastérisée par
 * Chromium aux tailles que chaque système attend. Rien à installer, rien à
 * payer, et les PNG produits sont versionnés : ce script ne tourne qu'au
 * changement d'icône.
 *
 * Ce que chaque système demande :
 *
 * — Android dessine l'icône en deux couches, un fond et un premier plan, puis
 *   la découpe selon le téléphone : cercle, carré arrondi, goutte. Seuls les
 *   72 dp centraux d'un carré de 108 restent visibles, le reste sert aux
 *   animations. L'icône est donc posée à 76 % : le dessin entier tient dans
 *   la zone visible, et les bords arrondis de l'original tombent dehors.
 * — Les téléphones d'avant Android 8 prennent une image unique, ronde ou non.
 * — iOS refuse la transparence : un coin transparent devient noir. Le fond
 *   de l'icône est donc prolongé jusqu'aux bords, et c'est iOS qui arrondit.
 * — L'écran de lancement : l'icône au centre, sur le fond sombre de
 *   l'application, pour que rien ne clignote entre lui et la première page.
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(ICI, '..');
const SOURCE = resolve(MOBILE, '../web/scripts/source-icone/source.png');
const RES = resolve(MOBILE, 'android/app/src/main/res');
const IOS = resolve(MOBILE, 'ios/App/App/Assets.xcassets');

/** Le dégradé de l'icône, relevé sur ses bords : le même que pour le site. */
const DEGRADE = 'linear-gradient(160deg, #1169cc 0%, #0a5aa8 55%, #0571a7 100%)';
/** Le fond de l'application au démarrage, celui du manifeste du site. */
const FOND_LANCEMENT = '#0b1220';

const DENSITES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
/** Les formats d'écran de lancement du modèle Capacitor, en portrait. */
const LANCEMENT_ANDROID = {
  mdpi: [320, 480],
  hdpi: [480, 800],
  xhdpi: [720, 1280],
  xxhdpi: [960, 1600],
  xxxhdpi: [1280, 1920],
};

function chargerPlaywright() {
  const essais = [
    () => createRequire(import.meta.url)('playwright'),
    () => createRequire(resolve(MOBILE, '../../package.json'))('playwright'),
  ];
  for (const essai of essais) {
    try {
      return essai();
    } catch {
      /* source suivante */
    }
  }
  throw new Error('Playwright est introuvable : installez les dépendances du dépôt.');
}

function chromium() {
  const candidats = [
    process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_BROWSERS_PATH
      ? resolve(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium')
      : null,
    '/opt/pw-browsers/chromium',
  ];
  const chemin = candidats.find((c) => c && existsSync(c));
  return chemin ? { executablePath: chemin } : {};
}

/**
 * Une image : un cadre de `largeur` × `hauteur`, un fond, et l'icône au
 * centre à `echelle` du plus petit côté. `rond` découpe le tout en disque.
 */
function page(image, { largeur, hauteur, fond, echelle, rond = false }) {
  const cote = Math.round(Math.min(largeur, hauteur) * echelle);
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:transparent}
  .cadre{width:${largeur}px;height:${hauteur}px;display:grid;place-items:center;overflow:hidden;
         background:${fond};${rond ? 'border-radius:50%;' : ''}}
  img{width:${cote}px;height:${cote}px;display:block}
</style>
<div class="cadre"><img src="${image}" alt=""></div>`;
}

function cibles() {
  const liste = [];
  for (const [densite, facteur] of Object.entries(DENSITES)) {
    const dossier = resolve(RES, `mipmap-${densite}`);
    const lanceur = Math.round(48 * facteur);
    const couche = Math.round(108 * facteur);
    // Avant Android 8 : l'icône telle quelle, coins arrondis compris.
    liste.push({
      fichier: resolve(dossier, 'ic_launcher.png'),
      largeur: lanceur,
      hauteur: lanceur,
      fond: 'transparent',
      echelle: 1,
    });
    liste.push({
      fichier: resolve(dossier, 'ic_launcher_round.png'),
      largeur: lanceur,
      hauteur: lanceur,
      fond: DEGRADE,
      // Agrandie jusqu'à ce que le disque tombe tout entier dans son fond :
      // plus petite, on verrait les coins du carré d'origine dans le rond.
      echelle: 1.1,
      rond: true,
    });
    // Android 8 et plus : le premier plan, posé sur la couche de fond.
    liste.push({
      fichier: resolve(dossier, 'ic_launcher_foreground.png'),
      largeur: couche,
      hauteur: couche,
      fond: 'transparent',
      echelle: 0.76,
    });
    // Écran de lancement d'avant Android 12, en portrait et en paysage.
    const tailles = LANCEMENT_ANDROID[densite];
    for (const [orientation, [l, h]] of [
      ['port', tailles],
      ['land', [tailles[1], tailles[0]]],
    ]) {
      liste.push({
        fichier: resolve(RES, `drawable-${orientation}-${densite}`, 'splash.png'),
        largeur: l,
        hauteur: h,
        fond: FOND_LANCEMENT,
        echelle: 0.32,
      });
    }
  }
  liste.push({
    fichier: resolve(RES, 'drawable', 'splash.png'),
    largeur: 480,
    hauteur: 320,
    fond: FOND_LANCEMENT,
    echelle: 0.32,
  });

  // iOS : une seule icône de 1024, opaque ; trois écrans de lancement carrés.
  liste.push({
    fichier: resolve(IOS, 'AppIcon.appiconset', 'AppIcon-512@2x.png'),
    largeur: 1024,
    hauteur: 1024,
    fond: DEGRADE,
    echelle: 1,
  });
  for (const nom of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    liste.push({
      fichier: resolve(IOS, 'Splash.imageset', nom),
      largeur: 2732,
      hauteur: 2732,
      fond: FOND_LANCEMENT,
      echelle: 0.2,
    });
  }
  return liste;
}

async function main() {
  if (!existsSync(SOURCE)) throw new Error(`Icône source introuvable : ${SOURCE}`);
  const image = `data:image/png;base64,${readFileSync(SOURCE).toString('base64')}`;

  const { chromium: navigateur } = chargerPlaywright();
  const instance = await navigateur.launch(chromium());
  try {
    for (const cible of cibles()) {
      mkdirSync(dirname(cible.fichier), { recursive: true });
      const contexte = await instance.newContext({
        viewport: { width: cible.largeur, height: cible.hauteur },
        deviceScaleFactor: 1,
      });
      const onglet = await contexte.newPage();
      await onglet.setContent(page(image, cible), { waitUntil: 'load' });
      await onglet.screenshot({
        path: cible.fichier,
        omitBackground: cible.fond === 'transparent' || cible.rond === true,
      });
      await contexte.close();
      console.log(`   ${cible.fichier.replace(`${MOBILE}/`, '')} (${cible.largeur}×${cible.hauteur})`);
    }
  } finally {
    await instance.close();
  }
}

main().catch((erreur) => {
  console.error(erreur.message);
  process.exit(1);
});
