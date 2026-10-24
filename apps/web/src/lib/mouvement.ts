/**
 * Le mouvement des interactions : ce que la page fait sous le doigt.
 *
 * Trois gestes, posés une fois pour toute l'application plutôt que composant
 * par composant :
 *
 * - **l'onde** : un appui sur un bouton (`.btn`) ou une carte cliquable
 *   (`.pressable`) fait partir un cercle du point touché. On voit où l'on a
 *   appuyé, et que l'appui a été pris ;
 * - **l'éclat** : quand une action aboutit (`signaler('reussite')`), une coche
 *   jaillit à l'endroit du dernier geste, entourée d'un anneau qui s'étend ;
 * - **la secousse** : quand elle échoue (`signaler('echec')`), le bouton qu'on
 *   vient de presser fait « non » de la tête.
 *
 * Tout est en CSS (`mouvement.css`) : ce module ne fait que poser et retirer
 * des éléments. Rien ne bouge quand l'appareil demande moins d'animations, ni
 * dans les tests unitaires, où une animation n'a rien à prouver.
 */

/** Le dernier appui : où, sur quoi, et quand. */
let dernier: { x: number; y: number; cible: HTMLElement | null; quand: number } | null = null;

/** Au-delà, le dernier appui n'a plus de lien avec ce qui aboutit. */
const MEMOIRE_MS = 4000;

/** Pour les tests : forcer le mouvement là où il serait coupé. */
let force: boolean | null = null;
export function forcerLeMouvement(valeur: boolean | null): void {
  force = valeur;
}

export function mouvementPermis(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (force !== null) return force;
  if (import.meta.env.MODE === 'test') return false;
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

/** Une onde qui part du point touché, dans l'élément touché. */
function onde(cible: HTMLElement, x: number, y: number): void {
  const boite = cible.getBoundingClientRect();
  // Un élément non positionné laisserait l'onde s'échapper ailleurs dans la page.
  if (getComputedStyle(cible).position === 'static') return;
  const rayon = Math.hypot(Math.max(x - boite.left, boite.right - x), Math.max(y - boite.top, boite.bottom - y));
  const cercle = document.createElement('span');
  cercle.className = 'onde';
  cercle.setAttribute('aria-hidden', 'true');
  cercle.style.left = `${x - boite.left}px`;
  cercle.style.top = `${y - boite.top}px`;
  cercle.style.width = cercle.style.height = `${rayon * 2}px`;
  cible.appendChild(cercle);
  cercle.addEventListener('animationend', () => cercle.remove(), { once: true });
  // Filet de sécurité : un onglet en arrière-plan ne joue pas l'animation.
  window.setTimeout(() => cercle.remove(), 1200);
}

let demarre = false;

/** À appeler une fois au démarrage. */
export function demarrerLeMouvement(): void {
  if (demarre || typeof window === 'undefined') return;
  demarre = true;
  window.addEventListener(
    'pointerdown',
    (evenement) => {
      const element = evenement.target instanceof Element ? evenement.target : null;
      const cible = element?.closest<HTMLElement>('button, a, [role="button"], [role="radio"], [role="switch"]') ?? null;
      dernier = { x: evenement.clientX, y: evenement.clientY, cible, quand: performance.now() };
      if (!mouvementPermis() || !cible) return;
      if (cible.matches('.btn, .pressable') && !cible.matches(':disabled, [aria-disabled="true"]')) {
        onde(cible, evenement.clientX, evenement.clientY);
      }
    },
    { capture: true, passive: true },
  );
}

/** Le dernier appui, s'il est assez récent pour avoir déclenché ce qui arrive. */
function appuiRecent() {
  if (!dernier || performance.now() - dernier.quand > MEMOIRE_MS) return null;
  return dernier;
}

const COCHE =
  '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path class="eclat-trait" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

/** Une coche qui jaillit là où l'on vient d'appuyer. */
export function celebrer(): void {
  if (!mouvementPermis()) return;
  const appui = appuiRecent();
  if (!appui) return;
  const eclat = document.createElement('span');
  eclat.className = 'eclat';
  eclat.setAttribute('aria-hidden', 'true');
  eclat.style.left = `${appui.x}px`;
  eclat.style.top = `${appui.y}px`;
  // Contenu fixe, écrit ici : aucune donnée extérieure n'y passe.
  eclat.innerHTML = `<span class="eclat-anneau"></span><span class="eclat-pastille">${COCHE}</span>`;
  document.body.appendChild(eclat);
  window.setTimeout(() => eclat.remove(), 1100);
}

/** Le bouton qu'on vient de presser fait « non ». */
export function secouer(): void {
  if (!mouvementPermis()) return;
  const cible = appuiRecent()?.cible;
  if (!cible?.isConnected) return;
  cible.classList.remove('secoue');
  // Relancer l'animation si elle vient déjà d'être jouée.
  void cible.offsetWidth;
  cible.classList.add('secoue');
  cible.addEventListener('animationend', () => cible.classList.remove('secoue'), { once: true });
}

/** Attendre, pour laisser une animation se finir. Immédiat quand rien ne bouge. */
export function laisserJouer(ms: number): Promise<void> {
  if (!mouvementPermis() || ms <= 0) return Promise.resolve();
  return new Promise((fin) => window.setTimeout(fin, ms));
}

/** Pour les tests. */
export function oublierLeDernierAppui(): void {
  dernier = null;
}
