import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { X } from 'lucide-react';
import { Mascotte, type GesteDePlumio } from '@/components/mascotte/Mascotte';
import { classesDeBouton } from '@/components/ui/classesDeBouton';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';
import { insecables } from '@/lib/typographie';
import { STEPS, useTripDraft, type StepId } from '@/stores/tripDraft';
import {
  ANCRES_DES_CHOIX,
  AUCUN_CHOIX,
  cheminDuDepart,
  etapeDeLaVisite,
  NOMBRE_D_ETAPES,
  type ChoixDeLaVisite,
  type EtapeDeLaVisite,
} from './etapesDeLaVisite';
import {
  estEnVue,
  LARGEUR_ORDINATEUR,
  MARGE,
  placerLaBulle,
  TAILLE_DE_PLUMIO_SUR_UN_CHAMP,
  type Ecran,
  type Placement,
  type Rectangle,
} from './placementDeLaBulle';

/** Le temps laissé à un écran pour afficher l'élément attendu (chargement, réseau lent). */
const ATTENTE_MAXIMALE = 6000;
const INTERVALLE_DE_RECHERCHE = 100;
/** Le temps que Plumio met à saluer et s'envoler, après « Terminer la visite ». */
const DUREE_DE_L_ENVOL = 600;
/** Sans réaction, Plumio rejoue son geste toutes les six secondes, trois fois au plus. */
const RELANCE = 6000;
const RELANCES_MAX = 3;
/** Le clavier du téléphone est ouvert quand il prend plus d'un quart de l'écran. */
const SEUIL_DU_CLAVIER = 0.75;

function mouvementReduit(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function ecranActuel(): Ecran {
  return { largeur: window.innerWidth, hauteur: window.innerHeight };
}

/** La première ancre présente et visible à l'écran, et la consigne qui va avec. */
function trouver(etape: EtapeDeLaVisite): { element: HTMLElement; texte: string } | null {
  for (const { ancre, texte } of etape.cibles) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-guide="${ancre}"]`)) {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 || height > 0) return { element, texte };
    }
  }
  return null;
}

/** Le champ à remplir, si la cible en est un : Plumio le picore au lieu de le montrer de l'aile. */
function champDe(element: HTMLElement): HTMLInputElement | null {
  const champ = element.matches('input') ? element : element.querySelector('input');
  if (!(champ instanceof HTMLInputElement)) return null;
  return ['radio', 'checkbox', 'hidden', 'button', 'submit'].includes(champ.type) ? null : champ;
}

function questionAffichee(): StepId | null {
  const valeur = document.querySelector('[data-question]')?.getAttribute('data-question');
  return (STEPS as readonly string[]).includes(valeur ?? '') ? (valeur as StepId) : null;
}

/** Le clavier du téléphone, et la hauteur qu'il laisse. */
function clavierOuvert(): { bas: number } | null {
  const vue = window.visualViewport;
  if (!vue || vue.height >= window.innerHeight * SEUIL_DU_CLAVIER) return null;
  return { bas: Math.max(0, window.innerHeight - vue.height - vue.offsetTop) };
}

/**
 * La visite guidée : comment créer un voyage, sur les vraies pages.
 *
 * Il n'y a pas de bouton « Suivant ». Plumio montre le vrai bouton (de
 * l'aile) ou le vrai champ (du bec) ; c'est la personne qui appuie, choisit ou
 * tape, et l'étape suivante se déduit de l'écran et du brouillon
 * (`etapesDeLaVisite.ts`). Rien ne change de page sans son appui.
 *
 * La page reste utilisable : le voile ne fait que l'assombrir, le clavier va
 * au vrai bouton, au vrai champ. La bulle n'est pas modale ; sa consigne est
 * annoncée à chaque étape. « Passer la visite » et Échap la terminent à tout
 * moment.
 *
 * Ailleurs que sur le chemin (un autre onglet, un voyage ouvert), la bulle se
 * replie en un petit Plumio, « Reprendre la visite ». Une fois arrivé au bout,
 * appuyer pour de bon sur « Créer le voyage » termine aussi la visite.
 *
 * Règles et maquettes : `design/mascotte/NOTES.md`, section 7.
 */
export default function VisiteGuidee({ surFermer }: { surFermer: () => void }) {
  const { identity } = useAuth();
  const naviguer = useNavigate();
  const { pathname } = useLocation();
  const brouillon = useTripDraft();
  const [question, setQuestion] = useState<StepId | null>(questionAffichee);
  const [choix, setChoix] = useState<ChoixDeLaVisite>(AUCUN_CHOIX);
  const [fin, setFin] = useState(false);
  const identite = Boolean(identity);
  const situation = etapeDeLaVisite({ chemin: pathname, question, identite }, brouillon, choix);
  const etape = situation.etat === 'etape' ? situation.etape : null;

  /** Où reprendre, si l'on s'égare : le dernier écran du chemin. */
  const dernierChemin = useRef<string | null>(null);
  const finAtteinte = useRef(false);

  // La question de l'assistant se lit sur la page : elle change sans changer d'adresse.
  useEffect(() => {
    const minuteur = window.setInterval(() => {
      const ici = questionAffichee();
      setQuestion((avant) => (avant === ici ? avant : ici));
    }, 150);
    return () => window.clearInterval(minuteur);
  }, []);

  // Ouverte loin du chemin (« Revoir le guide » depuis le profil) : la personne
  // vient d'appuyer sur « C'est parti », on la mène au bouton qui commence tout.
  useEffect(() => {
    if (situation.etat === 'hors-du-chemin') void naviguer(cheminDuDepart(identite));
    // Une fois, à l'ouverture : ensuite, c'est la personne qui navigue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les cartes choisies pendant la visite : un vrai appui, pas la réponse par défaut.
  useEffect(() => {
    const surAppui = (evenement: MouseEvent) => {
      const cible = evenement.target instanceof Element ? evenement.target : null;
      if (!cible) return;
      for (const [cle, ancre] of Object.entries(ANCRES_DES_CHOIX) as [keyof ChoixDeLaVisite, string][]) {
        if (cible.closest(`[data-guide="${ancre}"]`)) setChoix((avant) => (avant[cle] ? avant : { ...avant, [cle]: true }));
      }
    };
    document.addEventListener('click', surAppui, true);
    return () => document.removeEventListener('click', surAppui, true);
  }, []);

  // Échap termine la visite, à toute étape.
  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape' && !evenement.defaultPrevented) surFermer();
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [surFermer]);

  // Ce que la visite retient en chemin.
  const surLeChemin = etape !== null;
  const auBout = etape?.fin ?? false;
  useEffect(() => {
    if (surLeChemin) {
      dernierChemin.current = pathname;
      if (auBout) finAtteinte.current = true;
    } else if (finAtteinte.current) {
      // Arrivée au bout, la personne a appuyé pour de bon : le voyage est créé, la visite est finie.
      surFermer();
    }
  }, [surLeChemin, auBout, pathname, surFermer]);

  function terminer() {
    if (mouvementReduit()) {
      surFermer();
      return;
    }
    setFin(true);
    window.setTimeout(surFermer, DUREE_DE_L_ENVOL);
  }

  const texteAnnonce = etape ? null : 'Visite guidée en pause.';

  return (
    <div className="print:hidden">
      {etape ? (
        <EtapeAffichee
          key={etape.id}
          etape={etape}
          fin={fin}
          surTerminer={terminer}
          surPasser={surFermer}
        />
      ) : (
        <BulleRepliee
          surReprendre={() => void naviguer(dernierChemin.current ?? cheminDuDepart(identite))}
          surTerminer={surFermer}
        />
      )}
      {texteAnnonce && (
        <p role="status" className="sr-only">
          {texteAnnonce}
        </p>
      )}
    </div>
  );
}

/**
 * Une étape à l'écran : on attend la cible, on la met en lumière, et Plumio
 * la montre — de l'aile pour un bouton, du bec pour un champ.
 */
function EtapeAffichee({
  etape,
  fin,
  surTerminer,
  surPasser,
}: {
  etape: EtapeDeLaVisite;
  fin: boolean;
  surTerminer: () => void;
  surPasser: () => void;
}) {
  /** Ce que la recherche a trouvé ; `null` : rien après six secondes, la bulle parle au milieu. */
  const [trouve, setTrouve] = useState<{ element: HTMLElement | null; texte: string; rayon?: string } | null>(null);
  const [rectangle, setRectangle] = useState<Rectangle | null>(null);
  const [ecran, setEcran] = useState<Ecran>(ecranActuel);
  const [clavier, setClavier] = useState<{ bas: number } | null>(null);
  /** Le champ montré a du texte : Plumio arrête de picorer et regarde. */
  const [saisie, setSaisie] = useState(false);
  const [geste, setGeste] = useState<{ nom?: GesteDePlumio; fois: number }>({ fois: 0 });

  const element = trouve?.element ?? null;
  const champ = element ? champDe(element) : null;
  const bec = champ !== null;

  // On attend la cible, puis on la fait venir à l'écran.
  useEffect(() => {
    let fini = false;
    let minuteur = 0;
    const debut = performance.now();
    const chercher = () => {
      if (fini) return;
      const resultat = trouver(etape);
      if (resultat) {
        const { top, left, width, height } = resultat.element.getBoundingClientRect();
        const vue = ecranActuel();
        if (!estEnVue({ top, left, width, height }, vue)) {
          resultat.element.scrollIntoView({
            block: height > vue.hauteur * 0.6 ? 'start' : 'center',
            behavior: mouvementReduit() ? 'auto' : 'smooth',
          });
        }
        // Le cerne suit l'arrondi de l'élément.
        setTrouve({ ...resultat, rayon: getComputedStyle(resultat.element).borderRadius });
        return;
      }
      if (performance.now() - debut < ATTENTE_MAXIMALE) {
        minuteur = window.setTimeout(chercher, INTERVALLE_DE_RECHERCHE);
        return;
      }
      setTrouve({ element: null, texte: etape.cibles[0]?.texte ?? '' });
    };
    minuteur = window.setTimeout(chercher, 0);
    return () => {
      fini = true;
      window.clearTimeout(minuteur);
    };
  }, [etape]);

  // Le projecteur suit l'élément (défilement, contenu qui arrive au-dessus),
  // et l'on surveille le clavier et la saisie. Une mesure par image, un rendu
  // seulement quand quelque chose bouge.
  useEffect(() => {
    if (!element) return;
    let courant = element;
    let image = 0;
    const mesurer = () => {
      // L'écran peut remplacer l'élément par un autre identique.
      if (!courant.isConnected) courant = trouver(etape)?.element ?? courant;
      const { top, left, width, height } = courant.getBoundingClientRect();
      setRectangle((avant) =>
        avant &&
        Math.abs(avant.top - top) < 0.5 &&
        Math.abs(avant.left - left) < 0.5 &&
        Math.abs(avant.width - width) < 0.5 &&
        Math.abs(avant.height - height) < 0.5
          ? avant
          : { top, left, width, height },
      );
      setEcran((avant) => {
        const vue = ecranActuel();
        return avant.largeur === vue.largeur && avant.hauteur === vue.hauteur ? avant : vue;
      });
      const ouvert = clavierOuvert();
      setClavier((avant) => (avant?.bas === ouvert?.bas ? avant : ouvert));
      const ici = champDe(courant);
      setSaisie(Boolean(ici && ici.value.trim()));
      image = window.requestAnimationFrame(mesurer);
    };
    mesurer();
    return () => window.cancelAnimationFrame(image);
  }, [element, etape]);

  // Le clavier s'ouvre : le champ remonte en haut, pour que la liste tienne dans ce qui reste.
  const clavierPresent = clavier !== null;
  useEffect(() => {
    if (clavierPresent && element) element.scrollIntoView({ block: 'start', behavior: 'auto' });
  }, [clavierPresent, element]);

  // Le geste : à l'arrivée, puis toutes les six secondes sans réaction, trois fois au plus.
  // Avant de montrer « Continuer », un petit contentement : la réponse est bonne.
  useEffect(() => {
    if (!trouve?.element || fin || saisie || mouvementReduit()) return;
    const nom: GesteDePlumio = bec ? 'picore' : 'tapote';
    const minuteurs: number[] = [];
    let fois = 0;
    const jouer = (quoi: GesteDePlumio) => setGeste({ nom: quoi, fois: ++fois });
    if (etape.id.endsWith('-continuer')) {
      minuteurs.push(window.setTimeout(() => jouer('content'), 380));
      minuteurs.push(window.setTimeout(() => jouer(nom), 1100));
    } else if (!etape.fin) {
      minuteurs.push(window.setTimeout(() => jouer(nom), 420));
    }
    for (let relance = 1; relance <= RELANCES_MAX && !etape.fin; relance += 1) {
      minuteurs.push(window.setTimeout(() => jouer(nom), 1100 + relance * RELANCE));
    }
    return () => minuteurs.forEach((minuteur) => window.clearTimeout(minuteur));
  }, [trouve, bec, saisie, fin, etape]);

  if (!trouve) {
    // L'écran se charge : de quoi renoncer, sans rien imposer.
    return (
      <div className="apparition-tardive pb-safe fixed inset-x-0 bottom-0 z-50 flex justify-center p-4">
        <button
          type="button"
          onClick={surPasser}
          className={cn(classesDeBouton({ variant: 'secondary', size: 'sm' }), 'shadow-[var(--shadow-float)]')}
        >
          Passer la visite
        </button>
      </div>
    );
  }

  const texte = saisie && etape.texteEnSaisie ? etape.texteEnSaisie : trouve.texte;
  const rtl = document.documentElement.dir === 'rtl';
  const appareil = ecran.largeur >= LARGEUR_ORDINATEUR ? 'ordinateur' : 'telephone';
  const visible = element && rectangle ? rectangle : null;

  const placement = placerLaBulle(visible, ecran, { rtl, surLeChamp: bec, dessusImpose: bec && saisie });

  // Une ligne au lieu de la bulle : le clavier du téléphone est ouvert sur le
  // champ, ou la saisie a commencé et la liste occupe le dessous sans laisser
  // de place au-dessus. Collée au-dessus du clavier, ou de « Continuer ».
  if (bec && (clavier || (saisie && placement.mode !== 'dessus'))) {
    const barre = document.querySelector('[data-guide="continuer"]')?.parentElement?.getBoundingClientRect();
    const bas = clavier ? clavier.bas + 8 : barre ? Math.max(8, ecran.hauteur - barre.top + 8) : 16;
    return (
      <>
        <Annonce texte={texte} />
        <div
          role="group"
          aria-label="Visite guidée"
          className="surface-raised fixed inset-x-2 z-50 mx-auto flex h-12 max-w-md items-center gap-2 rounded-[var(--radius-card)] border border-[color:var(--border-fort)] ps-2 shadow-[var(--shadow-lift)]"
          style={{ bottom: bas }}
        >
          <Mascotte pose="regarde-gauche" taille={30} vie="calme" />
          <p className="min-w-0 flex-1 truncate text-sm">{insecables(texte)}</p>
          <BoutonPasser surPasser={surPasser} />
        </div>
      </>
    );
  }
  // Le voile s'efface quand il gênerait : à la fin (rien à imposer), pendant la saisie (la liste doit se lire).
  const voile = Boolean(visible) && !etape.fin && !(bec && saisie);
  const tailleSurLeChamp = TAILLE_DE_PLUMIO_SUR_UN_CHAMP[appareil];
  const retrait = etape.unite ? 52 : 16;

  return (
    <>
      <Annonce texte={texte} />
      {voile && visible && (
        // Le projecteur : l'élément tel quel, cerné de papier puis d'accent, la page assombrie autour.
        // Il ne retient aucun appui : c'est la page elle-même qu'on utilise.
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-50 shadow-[0_0_0_3px_var(--surface-raised),0_0_0_5px_var(--accent),0_0_0_200vmax_rgb(26_23_19/0.52)] dark:shadow-[0_0_0_3px_var(--surface-raised),0_0_0_5px_var(--accent),0_0_0_200vmax_rgb(0_0_0/0.5)]"
          style={{
            width: visible.width,
            height: visible.height,
            borderRadius: trouve.rayon,
            transform: `translate(${visible.left}px, ${visible.top}px)`,
          }}
        />
      )}

      {bec && visible && (
        // Debout sur le bord haut du champ, côté fin de ligne, tourné vers le début.
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 leading-none"
          style={{
            top: visible.top - tailleSurLeChamp + 6,
            left: rtl ? visible.left + retrait : visible.left + visible.width - retrait - tailleSurLeChamp,
            width: tailleSurLeChamp,
            height: tailleSurLeChamp,
          }}
        >
          <Mascotte
            pose={saisie ? 'regarde-gauche' : 'picore-gauche'}
            taille={tailleSurLeChamp}
            vie="calme"
            arrivee
            geste={geste.nom}
            fois={geste.fois}
          />
        </div>
      )}

      <Bulle
        placement={placement}
        etape={etape}
        texte={texte}
        fin={fin}
        plumioSurLaBulle={!bec}
        geste={geste}
        surTerminer={surTerminer}
        surPasser={surPasser}
      />
    </>
  );
}

/** La consigne, annoncée à chaque changement : la bulle n'est pas modale, on ne l'atteint pas forcément. */
function Annonce({ texte }: { texte: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {texte}
    </p>
  );
}

function BoutonPasser({ surPasser }: { surPasser: () => void }) {
  return (
    <button
      type="button"
      onClick={surPasser}
      className="text-muted hover:text-brand-600 dark:hover:text-brand-300 min-h-11 shrink-0 px-2 text-sm font-semibold"
    >
      Passer la visite
    </button>
  );
}

/** La pointe de la bulle, tournée vers l'élément : un carré pivoté qui reprend son fond et son filet. */
function Pointe({ placement }: { placement: Placement }) {
  const commun = 'surface-raised absolute size-3.5 rotate-45 border-[color:var(--border-fort)]';
  if (placement.mode === 'dessous') {
    return <span aria-hidden className={cn(commun, '-top-[7.5px] border-t border-l')} style={{ left: placement.pointe - 7 }} />;
  }
  if (placement.mode === 'dessus') {
    return <span aria-hidden className={cn(commun, '-bottom-[7.5px] border-r border-b')} style={{ left: placement.pointe - 7 }} />;
  }
  if (placement.mode === 'cote') {
    return placement.cote === 'gauche' ? (
      <span aria-hidden className={cn(commun, '-left-[7.5px] border-b border-l')} style={{ top: placement.pointe - 7 }} />
    ) : (
      <span aria-hidden className={cn(commun, '-right-[7.5px] border-t border-r')} style={{ top: placement.pointe - 7 }} />
    );
  }
  return null;
}

/**
 * La bulle : où l'on en est, la consigne, et Plumio debout dessus quand il
 * montre de l'aile. Pas de bouton pour avancer : c'est la page qui fait
 * avancer. Seule la dernière a « Terminer la visite ».
 */
function Bulle({
  placement,
  etape,
  texte,
  fin,
  plumioSurLaBulle,
  geste,
  surTerminer,
  surPasser,
}: {
  placement: Placement;
  etape: EtapeDeLaVisite;
  texte: string;
  fin: boolean;
  plumioSurLaBulle: boolean;
  geste: { nom?: GesteDePlumio; fois: number };
  surTerminer: () => void;
  surPasser: () => void;
}) {
  const terminer = useRef<HTMLButtonElement | null>(null);

  // À la dernière étape, le clavier arrive sur « Terminer la visite » ; avant,
  // il reste où il est : sur la page, qu'il faut utiliser.
  useEffect(() => {
    if (etape.fin) terminer.current?.focus({ preventScroll: true });
  }, [etape.fin]);

  const style: CSSProperties = { width: placement.largeur };
  if (placement.mode === 'dessous' || placement.mode === 'dessus' || placement.mode === 'cote') {
    style.left = placement.left;
    if (placement.mode === 'dessus') style.bottom = placement.bottom;
    else style.top = placement.top;
  } else if (placement.mode === 'ancree') {
    style.left = placement.left;
    style.bottom = `calc(${MARGE}px + env(safe-area-inset-bottom))`;
  }
  const maxHauteur = placement.mode === 'centre' ? undefined : placement.maxHauteur;

  return (
    <div style={style} className={cn('fixed z-50', placement.mode === 'centre' && 'inset-0 m-auto h-fit')}>
      {plumioSurLaBulle && (
        <div
          aria-hidden
          className="absolute bottom-[calc(100%-4px)] leading-none"
          style={{ left: placement.plumio.left, width: placement.plumio.taille, height: placement.plumio.taille }}
        >
          <Mascotte
            pose={fin ? 'au-revoir' : placement.plumio.pose}
            taille={placement.plumio.taille}
            vie={fin ? 'immobile' : 'calme'}
            joue={fin}
            arrivee={!fin}
            sortie={fin}
            geste={fin ? undefined : geste.nom}
            fois={geste.fois}
            regard
          />
        </div>
      )}

      <section
        role="group"
        aria-label="Visite guidée"
        style={{ maxHeight: maxHauteur }}
        className={cn(
          'surface-raised relative flex max-h-[80dvh] flex-col rounded-[var(--radius-card)] border border-[color:var(--border-fort)] shadow-[var(--shadow-lift)]',
          // La bulle arrive juste après Plumio : un fondu et une courte montée.
          'animate-[rise_220ms_var(--ease-pose)_120ms_both] transition-opacity duration-300',
          fin && 'opacity-0',
        )}
      >
        <Pointe placement={placement} />

        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto p-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <p className="etiquette">Visite guidée</p>
            <span className="flex gap-1" aria-hidden>
              {Array.from({ length: NOMBRE_D_ETAPES }, (_, index) => (
                <i
                  key={index}
                  className={cn(
                    'h-1 w-3 rounded-full',
                    index < etape.numero ? 'bg-brand-500' : 'bg-[color:var(--border-subtle)]',
                  )}
                />
              ))}
            </span>
          </div>
          <p className="text-[0.95rem] leading-relaxed lg:text-base">{insecables(texte)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-2 pb-2">
          <BoutonPasser surPasser={surPasser} />
          {etape.fin && (
            <button
              ref={terminer}
              type="button"
              onClick={surTerminer}
              className={cn(classesDeBouton({ variant: 'primary', size: 'sm' }), 'ms-auto me-2 mb-2')}
            >
              Terminer la visite
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Hors du chemin : la visite attend, repliée en un petit Plumio dans un coin.
 * Un appui la reprend là où elle en était — et revient à sa page, puisque
 * c'est la personne qui a appuyé.
 */
function BulleRepliee({ surReprendre, surTerminer }: { surReprendre: () => void; surTerminer: () => void }) {
  return (
    <div className="surface-raised fixed end-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex items-center rounded-full border border-[color:var(--border-fort)] shadow-[var(--shadow-float)] lg:bottom-6">
      <button type="button" onClick={surReprendre} className="flex min-h-14 items-center gap-2 rounded-full ps-2 pe-3 text-sm font-semibold">
        <Mascotte pose="attend" taille={34} vie="calme" />
        Reprendre la visite
      </button>
      <button
        type="button"
        onClick={surTerminer}
        aria-label="Terminer la visite"
        className="text-muted hover:text-brand-600 me-1 grid size-11 place-items-center rounded-full"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
