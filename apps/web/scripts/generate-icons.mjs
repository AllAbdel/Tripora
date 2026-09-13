/**
 * Génère le jeu d'icônes PWA à partir d'une source unique.
 *
 *   node scripts/generate-icons.mjs
 *
 * Source utilisée, par ordre de priorité :
 *   1. public/icons/source.png  ← déposez-y l'icône d'origine, elle prime
 *   2. public/icons/icon.svg    ← version vectorielle recréée, par défaut
 *
 * La rastérisation passe par Chromium (déjà présent dans l'environnement de
 * développement) : aucune dépendance native, aucun service en ligne, rien à
 * installer et rien à payer. Les PNG produits sont versionnés, donc ce script
 * n'a pas besoin de tourner en intégration continue.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS = resolve(HERE, '../public/icons');
/**
 * Le fond posé derrière l'icône quand il faut remplir le cadre.
 *
 * C'est le dégradé de l'icône elle-même, relevé sur ses bords haut et bas :
 * un aplat uni, si vif soit-il, laisserait un liseré visible aux quatre coins
 * arrondis. Avec le même dégradé, le raccord ne se voit pas.
 */
const BACKGROUND = 'linear-gradient(160deg, #1169cc 0%, #0a5aa8 55%, #0571a7 100%)';

/** Chromium peut venir du projet ou de l'installation globale de la machine. */
function loadPlaywright() {
  const candidates = [
    () => createRequire(import.meta.url)('playwright'),
    () => createRequire('/opt/node22/lib/node_modules/').resolve('playwright'),
  ];
  for (const attempt of candidates) {
    try {
      const result = attempt();
      return typeof result === 'string' ? createRequire(import.meta.url)(result) : result;
    } catch {
      /* on essaie la source suivante */
    }
  }
  throw new Error(
    "Playwright est introuvable. Les PNG déjà versionnés restent valables :\n" +
      "ce script n'est nécessaire que pour les régénérer.",
  );
}

/**
 * Où trouver Chromium quand Playwright ne le sait pas.
 *
 * Playwright cherche une version précise du « headless shell », qui n'est pas
 * toujours celle installée sur la machine : un environnement de développement
 * fourni avec un Chromium complet fait alors échouer le lancement, alors que
 * le navigateur est là. On lui donne le chemin quand on en connaît un, et on
 * le laisse se débrouiller sinon.
 */
function chemins() {
  const candidats = [
    process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_BROWSERS_PATH
      ? resolve(process.env.PLAYWRIGHT_BROWSERS_PATH, 'chromium')
      : null,
    '/opt/pw-browsers/chromium',
  ];
  for (const chemin of candidats) {
    if (chemin && existsSync(chemin)) return { executablePath: chemin };
  }
  return {};
}

/** Page HTML minimale contenant l'illustration, à la taille voulue. */
function page(inner, size, { scale = 1, bleed = false } = {}) {
  return `<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:transparent}
  .frame{width:${size}px;height:${size}px;display:grid;place-items:center;overflow:hidden;
         background:${bleed ? BACKGROUND : 'transparent'}}
  .art{width:${size}px;height:${size}px;transform:scale(${scale});transform-origin:center}
  .art svg,.art img{width:100%;height:100%;display:block}
</style>
<div class="frame"><div class="art">${inner}</div></div>`;
}

const TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  // iOS ne gère pas la transparence : il pose du noir derrière, puis applique
  // son propre masque arrondi. Sans fond, les quatre coins de l'icône sortent
  // noirs sur l'écran d'accueil.
  { file: 'apple-touch-icon.png', size: 180, bleed: true },
  // Zone de sécurité maskable : Android peut rogner jusqu'à 20 % sur les bords.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.78, bleed: true },
  { file: 'og-image.png', size: 512, bleed: true },
];

async function main() {
  const sourcePng = resolve(ICONS, 'source.png');
  const sourceSvg = resolve(ICONS, 'icon.svg');

  let inner;
  if (existsSync(sourcePng)) {
    const data = readFileSync(sourcePng).toString('base64');
    inner = `<img src="data:image/png;base64,${data}" alt="">`;
    console.log('→ Source : public/icons/source.png');
  } else if (existsSync(sourceSvg)) {
    inner = readFileSync(sourceSvg, 'utf8');
    console.log('→ Source : public/icons/icon.svg');
  } else {
    throw new Error('Aucune source trouvée dans public/icons/');
  }

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(chemins());
  try {
    for (const target of TARGETS) {
      const context = await browser.newContext({
        viewport: { width: target.size, height: target.size },
        deviceScaleFactor: 1,
      });
      const tab = await context.newPage();
      await tab.setContent(page(inner, target.size, target), { waitUntil: 'load' });
      await tab.screenshot({
        path: resolve(ICONS, target.file),
        omitBackground: !target.bleed,
      });
      await context.close();
      console.log(`   ${target.file} (${target.size}px)`);
    }
  } finally {
    await browser.close();
  }

  // Le favicon reste vectoriel : net à toutes les tailles, quelques kilo-octets.
  if (existsSync(sourceSvg)) {
    copyFileSync(sourceSvg, resolve(ICONS, 'favicon.svg'));
    console.log('   favicon.svg');
  }

  writeFileSync(
    resolve(ICONS, 'README.md'),
    [
      '# Icônes',
      '',
      'Fichiers générés par `pnpm --filter @tripora/web icons`.',
      '',
      "Pour utiliser l'icône d'origine plutôt que la version vectorielle recréée,",
      'déposez-la ici sous le nom `source.png` (1024×1024 de préférence) puis',
      'relancez la commande : tous les formats en découlent.',
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
