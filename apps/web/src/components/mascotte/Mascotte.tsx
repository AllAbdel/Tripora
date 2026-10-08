import { useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/cn';
// La feuille et les poses vivent avec leurs sources de dessin (design/mascotte,
// régénérées par outils/plumio.py) : l'application les lit telles quelles.
import '../../../../../design/mascotte/animations.css';

const DESSINS = import.meta.glob<string>('../../../../../design/mascotte/poses/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** Les vingt-trois poses de Plumio (voir `design/mascotte/NOTES.md`). */
export type PoseDeLaMascotte =
  | 'accueil'
  | 'pointer-haut'
  | 'pointer-bas'
  | 'pointer-gauche'
  | 'pointer-droite'
  | 'explique'
  | 'reflechit'
  | 'celebre'
  | 'attend'
  | 'hors-ligne'
  | 'oups'
  | 'chut'
  | 'notification'
  | 'depart'
  | 'au-revoir'
  | 'vol'
  // La visite guidée, version 2 : de face pour l'accueil, de profil pour les champs.
  | 'face'
  | 'picore-gauche'
  | 'picore-droite'
  | 'regarde-gauche'
  | 'regarde-droite'
  | 'sautille'
  | 'content';

/** Vers où il montre : l'élément mis en lumière, par rapport à lui. */
export type DirectionDuGeste = 'haut' | 'bas' | 'gauche' | 'droite';

/** Ce qui le fait bouger, posé en classes sur le dessin (voir `animations.css`). */
export type ViePlumio = 'immobile' | 'calme' | 'vie';

/**
 * Un geste joué une fois, sur place (section 9 de `animations.css`) : le
 * trajet d'un point à l'autre, lui, est à l'appelant.
 */
export type GesteDePlumio = 'arrive' | 'salue' | 'parle' | 'se-tourne' | 'tapote' | 'picore' | 'sautille' | 'content';

/** Combien dure chaque geste : la classe est retirée ensuite, pour pouvoir le rejouer. */
const DUREE_DU_GESTE: Record<GesteDePlumio, number> = {
  arrive: 1100,
  salue: 1200,
  parle: 1100,
  'se-tourne': 520,
  tapote: 700,
  picore: 900,
  sautille: 420,
  content: 640,
};

function dessin(pose: PoseDeLaMascotte): string {
  const brut = DESSINS[`../../../../../design/mascotte/poses/${pose}.svg`] ?? '';
  // La taille vient du conteneur ; le `xmlns` ne sert à rien dans du HTML.
  return brut.replace(' xmlns="http://www.w3.org/2000/svg"', '').replace('<svg ', '<svg width="100%" height="100%" ');
}

function mouvementReduit(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Plumio, l'hirondelle de Tripora.
 *
 * Dessiné par Claude Design (`design/mascotte/`) : seize poses en SVG, et une
 * feuille qui le colore (le foulard prend la couleur d'accent, le trait
 * s'éclaircit en mode sombre) et l'anime — en `transform` et `opacity`
 * seulement, sans rebond, et plus du tout quand on a demandé moins de
 * mouvement.
 *
 * Une fois par écran au plus, jamais à côté d'une décision (un vote, un
 * montant), jamais dans un formulaire (sauf pendant la visite guidée, qui
 * montre justement comment le remplir). Décoratif : ce qu'il « dit » est
 * toujours écrit à côté.
 *
 * En arabe, il se retourne avec la page : il regarde dans le sens de la
 * lecture.
 */
export function Mascotte({
  pose,
  taille,
  vie = 'immobile',
  joue = false,
  arrivee = false,
  sortie = false,
  petit,
  regard = false,
  geste,
  fois = 0,
  className,
}: {
  pose: PoseDeLaMascotte;
  /** En pixels : 24 à côté d'un texte, 64 à 80 dans le tutoriel, 120 à 160 sur un écran vide. */
  taille: number;
  /** `calme` : il respire et cligne ; `vie` : en plus, de petits gestes de temps en temps, sans JavaScript. */
  vie?: ViePlumio;
  /** Joue une fois le geste de la pose, à son apparition. */
  joue?: boolean;
  /** Arrive en volant, d'en haut. */
  arrivee?: boolean;
  /** S'envole et disparaît (600 ms) : la fin de la visite guidée. */
  sortie?: boolean;
  /** Sans les détails qui deviennent du bruit sous 40 px. Par défaut, selon la taille. */
  petit?: boolean;
  /** Suit parfois le pointeur des yeux (souris seulement). */
  regard?: boolean;
  /** Un geste à jouer une fois ; changer `fois` le rejoue. Rien en mouvement réduit. */
  geste?: GesteDePlumio;
  fois?: number;
  className?: string;
}) {
  const conteneur = useRef<HTMLSpanElement | null>(null);

  // Les classes d'animation se posent sur le dessin lui-même, après coup : les
  // mettre dans le HTML rejouerait tout à chaque rendu.
  useLayoutEffect(() => {
    const svg = conteneur.current?.firstElementChild;
    if (!svg) return;
    svg.classList.toggle('plumio--petit', petit ?? taille < 40);
    svg.classList.toggle('plumio--calme', vie === 'calme');
    svg.classList.toggle('plumio--vie', vie === 'vie');
  }, [pose, taille, petit, vie]);

  // Le geste de la pose, une fois, à l'arrivée : après l'atterrissage s'il y en a un.
  useLayoutEffect(() => {
    const svg = conteneur.current?.firstElementChild;
    if (!svg) return;
    if (sortie) {
      svg.classList.add('plumio--sort');
      return;
    }
    if (arrivee) svg.classList.add('plumio--atterrit');
    if (!joue) return;
    if (!arrivee) {
      svg.classList.add('plumio--joue');
      return;
    }
    const minuteur = window.setTimeout(() => svg.classList.add('plumio--joue'), 360);
    return () => window.clearTimeout(minuteur);
  }, [pose, joue, arrivee, sortie]);

  // Un geste piloté : la classe le temps de le jouer, puis retirée.
  useLayoutEffect(() => {
    const svg = conteneur.current?.firstElementChild;
    if (!svg || !geste || mouvementReduit()) return;
    const classe = `plumio--${geste}`;
    svg.classList.add(classe);
    const minuteur = window.setTimeout(() => svg.classList.remove(classe), DUREE_DU_GESTE[geste]);
    return () => {
      window.clearTimeout(minuteur);
      svg.classList.remove(classe);
    };
  }, [pose, geste, fois]);

  useRegardQuiSuit(conteneur, regard, pose.endsWith('-gauche'));

  return (
    <span
      ref={conteneur}
      aria-hidden
      className={cn('inline-block shrink-0 leading-none rtl:-scale-x-100', className)}
      style={{ width: taille, height: taille }}
      // Un dessin du dépôt, sans script ni lien : le SVG doit être dans la page
      // pour que la feuille l'anime et lui donne la couleur d'accent.
      dangerouslySetInnerHTML={{ __html: dessin(pose) }}
    />
  );
}

/**
 * Le regard, parfois : quand le pointeur passe à moins de 320 px, Plumio le
 * suit des yeux deux à quatre secondes, puis retourne à ses affaires. Jamais
 * au toucher, jamais quand on a demandé moins de mouvement.
 */
function useRegardQuiSuit(conteneur: React.RefObject<HTMLSpanElement | null>, actif: boolean, retourne: boolean) {
  useEffect(() => {
    const element = conteneur.current;
    if (!actif || !element || mouvementReduit() || !window.matchMedia?.('(pointer: fine)').matches) return;
    let suitJusqua = 0;
    let reposJusqua = 0;
    let image = 0;
    let minuteur = 0;
    let pointeur = { x: 0, y: 0 };

    const arreter = (svg: Element) => {
      svg.classList.remove('plumio--suit');
      (svg as SVGElement).style.removeProperty('--plumio-regard-x');
      (svg as SVGElement).style.removeProperty('--plumio-regard-y');
      // Puis un moment sans le suivre : « parfois », pas tout le temps.
      reposJusqua = performance.now() + 4000 + Math.random() * 4000;
    };

    const viser = () => {
      image = 0;
      const svg = element.firstElementChild as SVGElement | null;
      if (!svg) return;
      if (performance.now() > suitJusqua) {
        arreter(svg);
        return;
      }
      const boite = element.getBoundingClientRect();
      const miroir = (document.documentElement.dir === 'rtl') !== retourne ? -1 : 1;
      const x = Math.max(-1, Math.min(1, ((pointeur.x - (boite.left + boite.width / 2)) / 160) * miroir));
      const y = Math.max(-1, Math.min(1, (pointeur.y - (boite.top + boite.height / 2)) / 160));
      svg.style.setProperty('--plumio-regard-x', x.toFixed(2));
      svg.style.setProperty('--plumio-regard-y', y.toFixed(2));
    };

    const surMouvement = (evenement: PointerEvent) => {
      pointeur = { x: evenement.clientX, y: evenement.clientY };
      const maintenant = performance.now();
      const svg = element.firstElementChild;
      if (!svg) return;
      if (maintenant < suitJusqua) {
        if (!image) image = window.requestAnimationFrame(viser);
        return;
      }
      if (maintenant < reposJusqua) return;
      const boite = element.getBoundingClientRect();
      const distance = Math.hypot(pointeur.x - (boite.left + boite.width / 2), pointeur.y - (boite.top + boite.height / 2));
      if (distance > 320) return;
      const duree = 2000 + Math.random() * 2000;
      suitJusqua = maintenant + duree;
      svg.classList.add('plumio--suit');
      image = window.requestAnimationFrame(viser);
      window.clearTimeout(minuteur);
      minuteur = window.setTimeout(() => arreter(svg), duree);
    };

    window.addEventListener('pointermove', surMouvement, { passive: true });
    return () => {
      window.removeEventListener('pointermove', surMouvement);
      window.cancelAnimationFrame(image);
      window.clearTimeout(minuteur);
    };
  }, [conteneur, actif, retourne]);
}
