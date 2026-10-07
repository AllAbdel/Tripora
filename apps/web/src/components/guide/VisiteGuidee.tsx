import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { Mascotte } from '@/components/mascotte/Mascotte';
import { classesDeBouton } from '@/components/ui/classesDeBouton';
import { getCollaboration } from '@/lib/collaboration';
import { cn } from '@/lib/cn';
import { voyageDeLAdresse } from '@/lib/onglets';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { insecables } from '@/lib/typographie';
import { retenirLaReprise, type DepartDeLaVisite } from '@/stores/guide';
import {
  arretsPour,
  rangDeDepart,
  voyageDeLaVisite,
  type ArretDeLaVisite,
  type ContexteDeLaVisite,
} from './arretsDeLaVisite';
import { estEnVue, MARGE, placerLaBulle, type Ecran, type Placement, type Rectangle } from './placementDeLaBulle';

/** Le temps laissé à un écran pour afficher l'élément attendu (chargement, réseau lent). */
const ATTENTE_MAXIMALE = 6000;
const INTERVALLE_DE_RECHERCHE = 100;
/** Le temps que Plumio met à saluer et s'envoler, après « Terminer ». */
const DUREE_DE_L_ENVOL = 600;

interface Visite {
  contexte: ContexteDeLaVisite;
  arrets: ArretDeLaVisite[];
}

/** Le premier élément marqué présent et visible à l'écran. */
function trouver(cibles: readonly string[]): HTMLElement | null {
  for (const cible of cibles) {
    for (const element of document.querySelectorAll<HTMLElement>(`[data-guide="${cible}"]`)) {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 || height > 0) return element;
    }
  }
  return null;
}

function mouvementReduit(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function ecranActuel(): Ecran {
  return { largeur: window.innerWidth, hauteur: window.innerHeight };
}

function memeRectangle(a: Rectangle | null, b: Rectangle): boolean {
  return (
    a !== null &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/**
 * La visite guidée : le guide de démarrage joué sur les vraies pages.
 *
 * Arrêt après arrêt (`arretsDeLaVisite.ts`), elle mène à l'écran, attend que
 * l'élément y apparaisse, le met en lumière et l'explique dans une bulle. On
 * avance avec « Suivant » ou les flèches, on revient en arrière, et
 * « Passer » ou Échap la ferment à tout moment.
 *
 * Écrite avec `<dialog>` en modale : le reste de la page devient inerte (on
 * ne clique pas par mégarde sur ce qu'on regarde), le clavier reste dans la
 * bulle, et le lecteur d'écran l'annonce. Le voile et son trou sont dessinés
 * dans la boîte elle-même, au-dessus de tout.
 *
 * Si la personne quitte l'écran par ses propres moyens (le bouton retour du
 * téléphone), la visite s'arrête : elle a choisi d'aller ailleurs.
 */
export default function VisiteGuidee({
  depart,
  surFermer,
  surAttendreUnVoyage,
}: {
  depart: DepartDeLaVisite;
  surFermer: () => void;
  surAttendreUnVoyage: () => void;
}) {
  const queryClient = useQueryClient();
  const naviguer = useNavigate();
  const { pathname } = useLocation();
  const boite = useRef<HTMLDialogElement | null>(null);
  const sens = useRef<1 | -1>(1);
  const [visite, setVisite] = useState<Visite | null>(null);
  const [rang, setRang] = useState(0);
  /** L'arrêt dont l'écran a été atteint : le quitter ensuite ferme la visite. */
  const arriveSur = useRef<string | null>(null);
  /** L'arrêt dont la recherche est finie, et ce qu'elle a trouvé. */
  const [cible, setCible] = useState<{ arret: string; element: HTMLElement | null; rayon?: string } | null>(null);
  /** « Terminer » : Plumio salue et s'en va. */
  const [fin, setFin] = useState(false);
  /** Où est l'élément de cet arrêt, à l'écran. */
  const [mesure, setMesure] = useState<{ arret: string; rectangle: Rectangle } | null>(null);
  const [ecran, setEcran] = useState<Ecran>(ecranActuel);

  // Le voyage où se joue la visite, et ce qu'on peut y montrer.
  useEffect(() => {
    let annule = false;
    const depot = getTripRepository();
    const collaboration = Boolean(getCollaboration());
    // Rejouée depuis un voyage (la barre latérale, par exemple) : c'est lui qu'elle montre.
    const voyageId = depart.voyageId ?? voyageDeLAdresse(pathname);
    async function preparer(): Promise<ContexteDeLaVisite> {
      // Hors ligne, la requête échoue : ce que le cache connaît suffit.
      if (voyageId) {
        const cle = cleVoyage(voyageId);
        const voyage = await queryClient
          .fetchQuery({ queryKey: cle, queryFn: () => depot.get(voyageId), staleTime: 30_000 })
          .catch(() => queryClient.getQueryData<Awaited<ReturnType<typeof depot.get>>>(cle) ?? null);
        if (voyage) return { voyageId, destinationArretee: Boolean(voyage.lockedDestinationId), collaboration };
      }
      const cle = ['trips', depot.kind];
      const voyages = await queryClient
        .fetchQuery({ queryKey: cle, queryFn: () => depot.list(), staleTime: 30_000 })
        .catch(() => queryClient.getQueryData<Awaited<ReturnType<typeof depot.list>>>(cle) ?? []);
      return { ...voyageDeLaVisite(voyages), collaboration };
    }
    void preparer().then((contexte) => {
      if (annule) return;
      const arrets = arretsPour(contexte, depart);
      setVisite({ contexte, arrets });
      setRang(rangDeDepart(arrets, depart));
    });
    return () => {
      annule = true;
    };
    // La visite se prépare une fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const element = boite.current;
    if (element && !element.open && typeof element.showModal === 'function') element.showModal();
    return () => {
      if (element?.open && typeof element.close === 'function') element.close();
    };
  }, []);

  const arret = visite?.arrets[rang];
  const total = visite?.arrets.length ?? 0;
  const chemin = arret && visite ? arret.chemin(visite.contexte.voyageId ?? '') : null;
  const surPlace = chemin !== null && pathname === chemin;
  const derniere = rang === total - 1;

  // On mène à l'écran de l'arrêt, une fois par arrêt.
  useEffect(() => {
    if (chemin && pathname !== chemin) void naviguer(chemin);
    // Seulement quand l'arrêt change : le reste du temps, c'est la personne qui navigue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chemin]);

  // On retient où on en est, pour reprendre si l'application se ferme en route.
  useEffect(() => {
    if (!arret || !visite || arret.action === 'creer') return;
    retenirLaReprise({ etat: 'en-cours', arret: arret.id, voyageId: visite.contexte.voyageId, le: Date.now() });
  }, [arret, visite]);

  // Partie d'elle-même vers un autre écran : la visite s'arrête.
  useEffect(() => {
    if (arret && arriveSur.current === arret.id && !surPlace) surFermer();
  }, [arret, surPlace, surFermer]);

  // Sur place : on attend l'élément, puis on le fait venir à l'écran.
  useEffect(() => {
    if (!arret || !surPlace) return;
    arriveSur.current = arret.id;
    let fini = false;
    let minuteur = 0;
    const debut = performance.now();
    const chercher = () => {
      if (fini) return;
      const element = trouver(arret.cibles);
      if (element) {
        const { top, left, width, height } = element.getBoundingClientRect();
        const vue = ecranActuel();
        if (!estEnVue({ top, left, width, height }, vue)) {
          element.scrollIntoView({
            // Plus haut que l'écran : on en montre le début.
            block: height > vue.hauteur * 0.6 ? 'start' : 'center',
            behavior: mouvementReduit() ? 'auto' : 'smooth',
          });
        }
        // Le cerne suit l'arrondi de l'élément.
        setCible({ arret: arret.id, element, rayon: getComputedStyle(element).borderRadius });
        return;
      }
      if (performance.now() - debut < ATTENTE_MAXIMALE) {
        minuteur = window.setTimeout(chercher, INTERVALLE_DE_RECHERCHE);
        return;
      }
      if (arret.facultatif) {
        const suivant = rang + sens.current;
        if (suivant < 0 || suivant >= total) surFermer();
        else setRang(suivant);
        return;
      }
      // Introuvable : la bulle parle quand même, au milieu de l'écran.
      setCible({ arret: arret.id, element: null });
    };
    minuteur = window.setTimeout(chercher, 0);
    return () => {
      fini = true;
      window.clearTimeout(minuteur);
    };
  }, [arret, surPlace, rang, total, surFermer]);

  // Le projecteur suit l'élément : défilement, rotation, contenu qui arrive
  // au-dessus. Une mesure par image, mais un rendu seulement quand il bouge.
  const element = cible && arret && cible.arret === arret.id ? cible.element : null;
  useEffect(() => {
    if (!element || !arret) return;
    let courant = element;
    let precedent: Rectangle | null = null;
    let image = 0;
    const mesurer = () => {
      // Un écran qui se redessine peut remplacer l'élément par un autre identique.
      if (!courant.isConnected) courant = trouver(arret.cibles) ?? courant;
      const { top, left, width, height } = courant.getBoundingClientRect();
      const ici = { top, left, width, height };
      if (!memeRectangle(precedent, ici)) {
        precedent = ici;
        setMesure({ arret: arret.id, rectangle: ici });
      }
      setEcran((avant) => {
        const vue = ecranActuel();
        return avant.largeur === vue.largeur && avant.hauteur === vue.hauteur ? avant : vue;
      });
      image = window.requestAnimationFrame(mesurer);
    };
    mesurer();
    return () => window.cancelAnimationFrame(image);
  }, [element, arret]);

  function avancer() {
    if (!arret) return;
    if (arret.action === 'creer') {
      surAttendreUnVoyage();
      void naviguer('/voyages/nouveau');
      return;
    }
    if (derniere) {
      // Plumio salue et s'envole, puis la visite se ferme.
      if (mouvementReduit()) {
        surFermer();
        return;
      }
      setFin(true);
      window.setTimeout(surFermer, DUREE_DE_L_ENVOL);
      return;
    }
    sens.current = 1;
    setRang((valeur) => valeur + 1);
  }

  function reculer() {
    if (rang === 0) return;
    sens.current = -1;
    setRang((valeur) => valeur - 1);
  }

  const pret = arret !== undefined && cible?.arret === arret.id;
  const rectangle = mesure && arret && mesure.arret === arret.id ? mesure.rectangle : null;
  const rtl = document.documentElement.dir === 'rtl';
  const placement = pret ? placerLaBulle(element ? rectangle : null, ecran, { rtl }) : null;
  const voile = arret?.voile !== false;

  return (
    <dialog
      ref={boite}
      aria-label="Visite guidée"
      onCancel={(evenement) => {
        evenement.preventDefault();
        surFermer();
      }}
      onKeyDown={(evenement) => {
        if (!pret || fin) return;
        // En arabe, l'interface est en miroir : la flèche de gauche avance.
        const avant = rtl ? 'ArrowLeft' : 'ArrowRight';
        const arriere = rtl ? 'ArrowRight' : 'ArrowLeft';
        if (evenement.key === avant && !derniere && arret?.action !== 'creer') avancer();
        if (evenement.key === arriere) reculer();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-0 text-[color:var(--text-strong)] backdrop:bg-transparent print:hidden"
    >
      {pret && !voile ? null : pret && element && rectangle ? (
        // Le projecteur : l'élément tel quel, cerné de papier puis d'accent, et la page assombrie autour.
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 shadow-[0_0_0_3px_var(--surface-raised),0_0_0_5px_var(--accent),0_0_0_200vmax_rgb(26_23_19/0.52)] dark:shadow-[0_0_0_3px_var(--surface-raised),0_0_0_5px_var(--accent),0_0_0_200vmax_rgb(0_0_0/0.5)]"
          style={{
            width: rectangle.width,
            height: rectangle.height,
            borderRadius: cible?.rayon,
            transform: `translate(${rectangle.left}px, ${rectangle.top}px)`,
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgb(26_23_19/0.52)] dark:bg-black/50" />
      )}

      {pret && arret && placement ? (
        <Bulle
          key={arret.id}
          arret={arret}
          placement={placement}
          rang={rang}
          total={total}
          derniere={derniere}
          fin={fin}
          surSuivant={avancer}
          surPrecedent={reculer}
          surPasser={surFermer}
        />
      ) : (
        // L'écran se charge : de quoi patienter, ou renoncer.
        <div className="apparition-tardive pb-safe fixed inset-x-0 bottom-0 flex items-center justify-center gap-4 px-6 pt-6">
          <Loader2 className="size-5 animate-spin text-white" aria-label="Chargement" />
          <button
            type="button"
            onClick={surFermer}
            className="min-h-11 rounded-[var(--radius-card)] px-3 text-sm font-semibold text-white underline underline-offset-4"
          >
            Passer la visite
          </button>
        </div>
      )}
    </dialog>
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
 * La bulle, et Plumio debout dessus : ce que dit l'arrêt, d'où l'on en est,
 * et de quoi avancer.
 */
function Bulle({
  arret,
  placement,
  rang,
  total,
  derniere,
  fin,
  surSuivant,
  surPrecedent,
  surPasser,
}: {
  arret: ArretDeLaVisite;
  placement: Placement;
  rang: number;
  total: number;
  derniere: boolean;
  fin: boolean;
  surSuivant: () => void;
  surPrecedent: () => void;
  surPasser: () => void;
}) {
  const idTitre = useId();
  const idTexte = useId();
  const suivant = useRef<HTMLButtonElement | null>(null);

  // Le clavier arrive sur « Suivant » : Entrée avance, Tab mène au reste.
  // Le défilement, lui, reste celui que la visite a choisi.
  useEffect(() => {
    suivant.current?.focus({ preventScroll: true });
  }, []);

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
  const libelle = arret.action === 'creer' ? 'Créer mon voyage' : derniere ? 'Terminer' : 'Suivant';

  return (
    <div
      style={style}
      className={cn(
        'fixed',
        // Rien à désigner : au milieu de l'écran.
        placement.mode === 'centre' && 'inset-0 m-auto h-fit',
      )}
    >
      <div
        className="absolute bottom-[calc(100%-4px)] leading-none"
        style={{ left: placement.plumio.left, width: placement.plumio.taille, height: placement.plumio.taille }}
      >
        <Mascotte
          pose={fin ? 'au-revoir' : placement.plumio.pose}
          taille={placement.plumio.taille}
          vie={fin ? 'immobile' : 'calme'}
          joue
          arrivee={!fin}
          sortie={fin}
          regard
        />
      </div>

      <section
        role="group"
        aria-labelledby={idTitre}
        style={{ maxHeight: maxHauteur }}
        className={cn(
          'surface-raised relative flex max-h-[80dvh] flex-col rounded-[var(--radius-card)] border border-[color:var(--border-fort)] shadow-[var(--shadow-lift)]',
          // La bulle arrive juste après Plumio : un fondu et une courte montée.
          'animate-[rise_220ms_var(--ease-pose)_120ms_both] transition-opacity duration-300',
          fin && 'opacity-0',
        )}
      >
        <Pointe placement={placement} />

        <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto p-4">
          {/* Une seule étape (pas encore de voyage) : un compteur « 1 sur 1 » n'apprendrait rien. */}
          {total > 1 && (
            <div className="flex items-center justify-between gap-3">
              <p className="etiquette chiffres">{`Étape ${rang + 1} sur ${total}`}</p>
              <span className="flex gap-1" aria-hidden>
                {Array.from({ length: total }, (_, index) => (
                  <i
                    key={index}
                    className={cn(
                      'h-1 w-3.5 rounded-full',
                      index <= rang ? 'bg-brand-500' : 'bg-[color:var(--border-subtle)]',
                    )}
                  />
                ))}
              </span>
            </div>
          )}
          <h2 id={idTitre} className="leading-snug font-semibold">
            {insecables(arret.titre)}
          </h2>
          <p id={idTexte} className="text-muted text-[0.95rem] leading-relaxed">
            {insecables(arret.texte)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 px-4 pb-4">
          <button
            type="button"
            onClick={surPasser}
            className="text-muted hover:text-brand-600 dark:hover:text-brand-300 -ms-2 me-auto min-h-11 px-2 text-sm font-semibold"
          >
            Passer
          </button>
          {rang > 0 && (
            <button
              type="button"
              onClick={surPrecedent}
              aria-label="Étape précédente"
              className={classesDeBouton({ variant: 'ghost', size: 'sm' })}
            >
              <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
            </button>
          )}
          <button
            ref={suivant}
            type="button"
            onClick={surSuivant}
            aria-describedby={idTexte}
            className={classesDeBouton({ variant: 'primary', size: 'sm' })}
          >
            {libelle}
            {!derniere && <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />}
          </button>
        </div>
      </section>
    </div>
  );
}
