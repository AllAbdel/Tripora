import type { Page } from '@playwright/test';

/**
 * De quoi poser un voyage sans traverser l'assistant de création.
 *
 * Les tests de l'accueil parlent de l'accueil : leur faire remplir six écrans
 * avant chaque vérification les rendrait lents et fragiles, et un échec ne
 * dirait plus lequel des deux écrans est cassé. L'assistant a son propre test.
 */

/** Un brouillon complet, dans la forme que le dépôt local attend. */
export function brouillon(modifications: Record<string, unknown> = {}) {
  return {
    title: 'Bali entre potes',
    groupType: 'friends',
    participants: 4,
    origin: { name: 'Paris', lat: 48.8566, lng: 2.3522, iata: ['CDG'] },
    destinationMode: 'fixed',
    destinationIds: ['bali'],
    dateMode: 'month',
    startDate: null,
    endDate: null,
    windowStart: null,
    windowEnd: null,
    month: 7,
    durationDays: 12,
    budgetMode: 'max_per_person',
    budgetPerPersonCents: 180_000,
    comfortLevel: 'mid',
    weights: { nature: 1, relax: 0.66, food: 0.66, culture: 0.33 },
    avoid: [],
    ...modifications,
  };
}

export interface VoyagePose {
  id: string;
  titre: string;
  cree: string;
  draft?: Record<string, unknown>;
}

const coupees = new WeakSet<Page>();

/**
 * Internet coupé, sauf l'application elle-même.
 *
 * Les écrans appellent Wikipédia pour les photos et OpenFreeMap pour la
 * carte. Laissés libres, ces appels rendent les tests dépendants d'un réseau
 * que la machine n'a pas toujours : sur un réseau fermé, ils attendent le
 * délai de connexion, et le test qui visite vingt-quatre écrans dépassait ses
 * trente secondes. Coupés net, ils échouent tout de suite — ce que
 * l'application sait déjà encaisser, puisqu'elle doit marcher hors ligne.
 *
 * La politique de sécurité, elle, reste vérifiée : le navigateur l'applique
 * avant que la requête n'atteigne ce filtre, et un refus laisse toujours sa
 * ligne dans la console.
 */
async function couperInternet(page: Page): Promise<void> {
  if (coupees.has(page)) return;
  coupees.add(page);
  await page.route(/^https?:\/\/(?!localhost[:/])/u, (requete) => requete.abort('internetdisconnected'));
}

/**
 * Ouvre l'application avec une identité locale et des voyages déjà là.
 *
 * On écrit dans le stockage avant de charger l'écran visé : l'application lit
 * le stockage au démarrage, et le remplir après coup ne changerait rien à ce
 * qui est affiché.
 */
export async function poser(
  page: Page,
  voyages: readonly VoyagePose[],
  route = '/voyages',
): Promise<void> {
  await couperInternet(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate((entrees) => {
    localStorage.setItem(
      'tripora.local-identity',
      JSON.stringify({
        id: 'moi',
        displayName: 'Voyageur',
        isAnonymous: true,
        mode: 'local',
      }),
    );
    localStorage.setItem('tripora.local-trips', JSON.stringify(entrees));
    localStorage.removeItem('tripora.favoris');
  }, voyages.map((v) => ({ id: v.id, title: v.titre, createdAt: v.cree, draft: v.draft })));
  await page.goto(route, { waitUntil: 'networkidle' });
  // On attend que l'application ait rendu, pas qu'un titre précis existe :
  // c'est justement ce que les tests ont à vérifier.
  await page.locator('#root > *').first().waitFor({ state: 'attached' });
}

/** Le voyage de référence : destination arrêtée, quatre personnes, Bali. */
export const BALI: VoyagePose = {
  id: 'v1',
  titre: 'Bali entre potes',
  cree: '2026-09-08T10:00:00.000Z',
  draft: brouillon(),
};

/** Un second voyage, pour vérifier les tris et les listes. */
export const LISBONNE: VoyagePose = {
  id: 'v2',
  titre: 'Week-end à Lisbonne',
  cree: '2026-09-07T10:00:00.000Z',
  draft: brouillon({ title: 'Week-end à Lisbonne', destinationIds: ['lisbonne'], durationDays: 3 }),
};

/**
 * Fait glisser une carte, comme un pouce le ferait.
 *
 * Le geste part du milieu de la carte : les deux boutons d'action arrêtent
 * volontairement la propagation, et un geste amorcé sur eux ne démarrerait
 * jamais. Le déplacement se fait en petits pas parce que le composant décide
 * de l'axe au deuxième mouvement — un saut d'un seul bond ne ressemble à
 * aucun geste humain, et ne déclencherait rien.
 */
export async function glisser(page: Page, index: number, dx: number): Promise<void> {
  const carte = page.locator('li').nth(index).locator('a').first();
  const boite = await carte.boundingBox();
  if (!boite) throw new Error('Carte introuvable : rien à faire glisser.');
  const y = boite.y + boite.height / 2;
  const depart = boite.x + boite.width / 2;

  await page.mouse.move(depart, y);
  await page.mouse.down();
  const pas = Math.sign(dx) * 10;
  for (let parcouru = 0; Math.abs(parcouru) < Math.abs(dx); parcouru += pas) {
    await page.mouse.move(depart + parcouru, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.move(depart + dx, y);
  await page.mouse.up();
}

/**
 * Attend que le cache des requêtes soit vraiment écrit dans le stockage.
 *
 * Il l'est au plus une fois par seconde : recharger avant cette écriture
 * repart d'un cache vide, et le test ne vérifie alors rien du tout. C'est
 * précisément ce qui distingue la première visite de la seconde — et la
 * seconde est celle qui affichait une page blanche.
 */
export async function attendreLeCache(page: Page, requete: string): Promise<void> {
  await page.waitForFunction(
    (cle) => (localStorage.getItem('tripora.cache') ?? '').includes(cle),
    requete,
    { timeout: 8_000 },
  );
}
