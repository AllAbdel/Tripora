import { useT } from '@/i18n/useT';

/**
 * « Aller au contenu » : le premier arrêt de la touche Tab, invisible tant
 * qu'il n'a pas le focus.
 *
 * Sans lui, quelqu'un qui navigue au clavier ou au lecteur d'écran traverse
 * toute la navigation à chaque écran avant d'atteindre ce qu'il est venu lire.
 * Le lien vise le contenu principal de la page (`<main>`, ou le cadre marqué
 * `#contenu`) et y pose le focus — sans toucher à l'adresse de la page, dont
 * le fragment sert au retour de connexion.
 */
export function LienDEvitement() {
  const t = useT();
  return (
    <a
      href="#contenu"
      onClick={(evenement) => {
        const cible = document.querySelector<HTMLElement>('main') ?? document.getElementById('contenu');
        if (!cible) return;
        evenement.preventDefault();
        if (!cible.hasAttribute('tabindex')) cible.setAttribute('tabindex', '-1');
        cible.focus({ preventScroll: true });
        cible.scrollIntoView({ block: 'start' });
      }}
      className="bg-brand-500 sr-only rounded-[var(--radius-card)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] shadow-[var(--shadow-float)] focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-[60]"
    >
      {t('nav.contenu')}
    </a>
  );
}
