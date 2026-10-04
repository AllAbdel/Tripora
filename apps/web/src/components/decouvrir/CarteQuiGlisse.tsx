import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import { ChevronDown, Heart, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type Decision = 'envie' | 'sans-moi';

export interface CarteQuiGlisseRef {
  /** Faire partir la carte comme si on l'avait glissée : pour les boutons et le clavier. */
  lancer(decision: Decision): void;
}

/** Au-delà, le geste décide ; en deçà, la carte revient à sa place. */
const SEUIL_HORIZONTAL = 96;
const SEUIL_VERS_LE_BAS = 110;
const DUREE_DE_SORTIE_MS = 240;

function mouvementReduit(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/**
 * Une carte qu'on glisse : à droite, on garde ; à gauche, on passe ; vers le
 * bas, on revient à la précédente.
 *
 * Le geste suit le doigt — la carte penche, un tampon apparaît et s'affirme à
 * mesure qu'on approche du seuil — puis s'envole du côté choisi. À la souris,
 * le même geste marche ; au clavier et pour les lecteurs d'écran, les boutons
 * de l'écran font la même chose (`lancer`).
 */
export function CarteQuiGlisse({
  ref,
  surDecision,
  surRetour,
  peutRevenir,
  children,
  etiquette,
}: {
  ref?: Ref<CarteQuiGlisseRef>;
  surDecision: (decision: Decision) => void;
  surRetour: () => void;
  peutRevenir: boolean;
  children: ReactNode;
  /** Le nom de l'idée, pour les lecteurs d'écran. */
  etiquette: string;
}) {
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const [enMain, setEnMain] = useState(false);
  const [sortie, setSortie] = useState<Decision | null>(null);
  const [coeur, setCoeur] = useState(false);
  const depart = useRef<{ x: number; y: number } | null>(null);

  function envoler(decision: Decision) {
    if (sortie) return;
    if (mouvementReduit()) {
      surDecision(decision);
      return;
    }
    setSortie(decision);
    window.setTimeout(() => surDecision(decision), DUREE_DE_SORTIE_MS);
  }

  useImperativeHandle(ref, () => ({ lancer: envoler }));

  function relacher() {
    if (!depart.current) return;
    depart.current = null;
    setEnMain(false);
    if (delta.x > SEUIL_HORIZONTAL) envoler('envie');
    else if (delta.x < -SEUIL_HORIZONTAL) envoler('sans-moi');
    else {
      if (delta.y > SEUIL_VERS_LE_BAS && Math.abs(delta.x) < 80 && peutRevenir) surRetour();
      setDelta({ x: 0, y: 0 });
    }
  }

  const x = sortie === 'envie' ? window.innerWidth * 1.2 : sortie === 'sans-moi' ? -window.innerWidth * 1.2 : delta.x;
  // Vers le bas, la carte résiste : on sent qu'il y a quelque chose derrière.
  const y = sortie ? delta.y : Math.max(0, delta.y) * 0.35;
  const rotation = x / 18;
  const envie = Math.min(1, Math.max(0, delta.x / SEUIL_HORIZONTAL));
  const refus = Math.min(1, Math.max(0, -delta.x / SEUIL_HORIZONTAL));
  const retour = peutRevenir ? Math.min(1, Math.max(0, delta.y / SEUIL_VERS_LE_BAS)) * (Math.abs(delta.x) < 80 ? 1 : 0) : 0;

  return (
    <div
      role="group"
      aria-roledescription="carte"
      aria-label={etiquette}
      className={cn(
        'absolute inset-0 touch-none select-none',
        !enMain && 'transition-transform duration-[240ms] ease-out',
        enMain ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={{ transform: `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg)` }}
      onPointerDown={(event) => {
        // Un lien ou un bouton dans la carte reste un lien ou un bouton.
        if ((event.target as HTMLElement).closest('a, button')) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        depart.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        setEnMain(true);
      }}
      onPointerMove={(event) => {
        if (!depart.current) return;
        setDelta({ x: event.clientX - depart.current.x, y: event.clientY - depart.current.y });
      }}
      onPointerUp={relacher}
      onPointerCancel={relacher}
      // Deux petites tapes : j'y vais, comme on aime une vidéo. Le cœur jaillit
      // au milieu, puis la carte part à droite.
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('a, button') || sortie) return;
        setCoeur(true);
        window.setTimeout(() => envoler('envie'), mouvementReduit() ? 0 : 380);
      }}
    >
      {children}

      {coeur && (
        <Heart
          aria-hidden
          className="coeur-qui-jaillit pointer-events-none absolute top-1/2 left-1/2 size-32 -translate-x-1/2 -translate-y-1/2 fill-current text-rose-400 drop-shadow-2xl"
        />
      )}

      {/* Les tampons : ils disent ce que le geste va faire avant qu'il le fasse. */}
      <Tampon visible={envie} className="top-8 left-6 -rotate-12 border-emerald-400 text-emerald-300">
        <Heart className="size-6 fill-current" aria-hidden />
        J’y vais
      </Tampon>
      <Tampon visible={refus} className="top-8 right-6 rotate-12 border-rose-400 text-rose-300">
        <X className="size-6" aria-hidden />
        Pas pour moi
      </Tampon>
      <Tampon visible={retour} className="top-8 left-1/2 -translate-x-1/2 border-white/80 text-white">
        <ChevronDown className="size-6" aria-hidden />
        La précédente
      </Tampon>
    </div>
  );
}

function Tampon({ visible, className, children }: { visible: number; className: string; children: ReactNode }) {
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inline-flex items-center gap-2 rounded-xl border-4 bg-black/25 px-3 py-1.5',
        'text-xl font-black tracking-wider uppercase',
        className,
      )}
      style={{ opacity: visible }}
    >
      {children}
    </span>
  );
}
