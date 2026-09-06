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
const BACKGROUND = '#0a84ff';

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
  { file: 'apple-touch-icon.png', size: 180 },
  // Zone de sécurité maskable : Android peut rogner jusqu'à 20 % sur les bords.
  { file: 'icon-maskable-512.png', size: 512, scale: 0.78, bleed: true },
  { file: 'og-image.png', size: 512 },
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
  const browser = await chromium.launch();
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
