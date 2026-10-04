/**
 * Parcours automatisé sur l'application réellement construite.
 *
 * Les tests unitaires vérifient des fonctions ; celui-ci vérifie qu'un groupe
 * peut créer un voyage et voir des propositions dans un vrai navigateur, sur
 * le bundle de production. C'est le seul filet qui attrape ce que ni
 * TypeScript ni Vitest ne voient : une erreur au montage, un composant qui
 * plante au rechargement, un écran vide.
 *
 * Il a déjà payé une fois : il a trouvé qu'une `Map` mise en cache persistant
 * ressortait vide de JSON et faisait planter l'écran hors réseau, exactement
 * le scénario du voyage à l'étranger.
 *
 *   pnpm --filter @tripora/web smoke
 *
 * Il se lance en **mode local** — sans clés, sans réseau vers Supabase — pour
 * rester reproductible et ne rien consommer d'aucun quota gratuit.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.SMOKE_PORT ?? 4173);
const BASE = `http://localhost:${PORT}`;
/** Le conteneur fournit son propre Chromium ; sinon, celui de Playwright. */
const NAVIGATEUR = process.env.SMOKE_CHROMIUM;

const echecs = [];
const verifier = (nom, condition) => {
  if (condition) console.log(`  ✓ ${nom}`);
  else {
    console.log(`  ✗ ${nom}`);
    echecs.push(nom);
  }
};

const serveur = spawn('node', [new URL('./serve-dist.mjs', import.meta.url).pathname], {
  stdio: 'inherit',
  env: { ...process.env, SMOKE_PORT: String(PORT) },
});
await attendre(BASE);

const nav = await chromium.launch(NAVIGATEUR ? { executablePath: NAVIGATEUR } : {});
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });

const erreurs = [];
page.on('console', (message) => {
  if (message.type() === 'error') erreurs.push(message.text().slice(0, 200));
});
page.on('pageerror', (erreur) => erreurs.push(`plantage : ${String(erreur).slice(0, 200)}`));

const texte = () => page.locator('body').innerText();

try {
  console.log('\nConnexion en mode local');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /mode local/i }).click();
  await page.waitForLoadState('networkidle');
  verifier('arrive sur la liste des voyages', page.url().endsWith('/voyages'));

  console.log('\nCréation d’un voyage en six étapes');
  await page.getByRole('link', { name: /nouveau|créer/i }).first().click();
  await page.waitForLoadState('networkidle');
  await page.getByText(/Entre amis/).first().click();
  await suivant(page);

  await page.getByRole('textbox').first().fill('Lyon');
  await page.waitForTimeout(400);
  await page.getByText(/^Lyon/).first().click();
  await suivant(page);
  await suivant(page); // destination : « surprends-nous »

  const octobre = page.getByRole('button', { name: /^octobre$/i }).first();
  if (await octobre.count()) await octobre.click();
  await suivant(page);

  const budget = page.getByRole('textbox').first();
  if (await budget.count()) await budget.fill('400');
  await suivant(page);

  // Quatre niveaux par axe : Culture « Beaucoup », Gastronomie « Essentiel ».
  const niveaux = page.getByRole('radio');
  await niveaux.nth(2).click();
  await niveaux.nth(11).click();
  await page.getByRole('button', { name: /créer le voyage/i }).click();
  await page.waitForTimeout(1500);
  verifier('le voyage est créé', /\/voyages\/[0-9a-f-]{36}$/.test(page.url()));

  console.log('\nÉcran du voyage');
  const voyage = await texte();
  verifier('« Où on en est » liste ce qui bloque', voyage.includes('Où on en est'));
  verifier('des propositions sont classées', /destinations pour votre groupe/.test(voyage));
  verifier('les prix portent leur étiquette', voyage.includes('Prix indicatifs'));

  const titres = await page.locator('h3').allTextContents();
  verifier('six destinations sont proposées', titres.length === 6);

  const chiffres = await page.locator('p:has(svg) span.tabular-nums').allTextContents();
  verifier('chaque proposition montre son climat', chiffres.length === 12);
  verifier(
    'les températures sont plausibles',
    chiffres.filter((v) => v.includes('°C')).every((v) => {
      const degres = Number.parseInt(v, 10);
      return degres > -30 && degres < 50;
    }),
  );

  console.log('\nDétail d’une proposition');
  await page.getByRole('button', { name: /voir le détail/i }).first().click();
  await page.waitForTimeout(400);
  const detail = await texte();
  verifier('la bande des douze mois est là', detail.includes('Quand y aller'));
  verifier('les normales sont datées', detail.includes('Normales mesurées'));
  verifier('la note est ventilée par facteur', detail.includes('Comment la note est calculée'));

  console.log('\nDépenses');
  const voyageUrl = page.url().replace(/#.*$/u, '');
  await page.goto(`${voyageUrl}/budget`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /ajouter une dépense/i }).click();
  await page.getByRole('textbox', { name: /intitulé/i }).fill('Dîner au marché');
  await page.getByRole('textbox', { name: /^montant$/i }).fill('48,50');
  await page.getByRole('button', { name: /enregistrer/i }).click();
  await page.waitForTimeout(600);
  const comptes = await texte();
  // Le montant doit revenir au centime : c'est le chemin où `amountCents` est
  // devenu le montant converti, et une erreur d'un centime se voit ici.
  verifier('la dépense est enregistrée au centime', comptes.includes('48,50'));
  verifier('le total suit', /Total dépensé/.test(comptes));
  await page.goto(voyageUrl, { waitUntil: 'networkidle' });

  console.log('\nHors réseau');
  await page.context().setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const horsLigne = await texte();
  verifier('un bandeau prévient', horsLigne.includes('Hors réseau'));
  // Le vrai enjeu : le contenu doit survivre au rechargement, pas seulement
  // le bandeau. C'est ici qu'un cache mal sérialisé se voit.
  verifier('le voyage reste lisible', horsLigne.includes('Où on en est'));
  await page.context().setOffline(false);

  console.log('\nJournal du navigateur');
  verifier('aucune erreur', erreurs.length === 0);
  for (const erreur of new Set(erreurs)) console.log(`     ${erreur}`);
} finally {
  await nav.close();
  serveur.kill();
}

console.log(
  echecs.length === 0
    ? '\nParcours complet : tout est passé.\n'
    : `\n${echecs.length} vérification(s) en échec.\n`,
);
process.exit(echecs.length === 0 ? 0 : 1);

async function suivant(page) {
  await page.getByRole('button', { name: /continuer|suivant/i }).first().click();
  await page.waitForTimeout(350);
}

async function attendre(url, essais = 40) {
  for (let essai = 0; essai < essais; essai += 1) {
    try {
      const reponse = await fetch(url);
      if (reponse.ok) return;
    } catch {
      // Le serveur n'écoute pas encore.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Le serveur de test n’a pas démarré sur ${url}`);
}
