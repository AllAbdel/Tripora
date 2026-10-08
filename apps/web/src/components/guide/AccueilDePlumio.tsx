import { useEffect, useId, useRef, useState } from 'react';
import { Mascotte, type GesteDePlumio, type PoseDeLaMascotte } from '@/components/mascotte/Mascotte';
import { classesDeBouton } from '@/components/ui/classesDeBouton';
import { insecables } from '@/lib/typographie';

/** Le temps de se tourner avant de partir montrer le premier bouton. */
const DUREE_DU_DEMI_TOUR = 520;
/** Au revoir, puis l'envol : la fenêtre se ferme ensuite. */
const DUREE_DE_L_AU_REVOIR = 1100;
const DUREE_DE_L_ENVOL = 600;

function mouvementReduit(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * L'accueil du guide : Plumio, en grand et de face, se présente.
 *
 * Il arrive en volant, fait coucou, puis « parle » pendant qu'on lit — le
 * texte, lui, est là dès le début : on ne fait pas attendre la lecture.
 * « C'est parti » : il se tourne et part montrer le premier bouton ;
 * « Passer » (ou Échap) : il dit au revoir et s'envole.
 *
 * Une fenêtre modale (`<dialog>`), le focus sur « C'est parti ». En
 * mouvement réduit, rien ne bouge et tout se ferme sans attendre.
 *
 * Chorégraphie : `design/mascotte/NOTES.md`, section 7, « L'accueil ».
 */
export default function AccueilDePlumio({
  surCommencer,
  surPasser,
}: {
  surCommencer: () => void;
  surPasser: () => void;
}) {
  const boite = useRef<HTMLDialogElement | null>(null);
  const commencer = useRef<HTMLButtonElement | null>(null);
  const idTitre = useId();
  const idTexte = useId();
  const [pose, setPose] = useState<PoseDeLaMascotte>('face');
  const [geste, setGeste] = useState<{ nom?: GesteDePlumio; fois: number }>({ fois: 0 });
  const [sortie, setSortie] = useState(false);
  const [depart, setDepart] = useState<'commencer' | 'passer' | null>(null);
  const [grand] = useState(() => window.innerWidth >= 1024);

  useEffect(() => {
    const element = boite.current;
    if (element && !element.open && typeof element.showModal === 'function') element.showModal();
    commencer.current?.focus();
    return () => {
      if (element?.open && typeof element.close === 'function') element.close();
    };
  }, []);

  // L'arrivée : il descend et se pose, fait coucou, puis parle deux phrases.
  useEffect(() => {
    if (mouvementReduit()) return;
    const temps: [number, GesteDePlumio][] = [
      [0, 'arrive'],
      [1150, 'salue'],
      [2450, 'parle'],
      [3550, 'parle'],
    ];
    const minuteurs = temps.map(([apres, nom], fois) => window.setTimeout(() => setGeste({ nom, fois }), apres));
    return () => minuteurs.forEach((minuteur) => window.clearTimeout(minuteur));
  }, []);

  function partir(choix: 'commencer' | 'passer') {
    if (depart) return;
    setDepart(choix);
    if (mouvementReduit()) {
      if (choix === 'commencer') surCommencer();
      else surPasser();
      return;
    }
    if (choix === 'commencer') {
      setGeste({ nom: 'se-tourne', fois: 10 });
      window.setTimeout(surCommencer, DUREE_DU_DEMI_TOUR);
      return;
    }
    setPose('au-revoir');
    setGeste({ fois: 11 });
    window.setTimeout(() => setSortie(true), DUREE_DE_L_AU_REVOIR - DUREE_DE_L_ENVOL);
    window.setTimeout(surPasser, DUREE_DE_L_AU_REVOIR);
  }

  return (
    <dialog
      ref={boite}
      aria-labelledby={idTitre}
      aria-describedby={idTexte}
      onCancel={(evenement) => {
        evenement.preventDefault();
        partir('passer');
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto border-0 bg-[color:var(--surface-muted)] p-0 text-[color:var(--text-strong)] backdrop:bg-transparent print:hidden"
    >
      <div className="pb-safe mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center lg:max-w-lg">
        <Mascotte
          key={pose}
          pose={pose}
          taille={grand ? 200 : 168}
          vie={depart ? 'immobile' : 'calme'}
          joue={pose === 'au-revoir'}
          sortie={sortie}
          geste={geste.nom}
          fois={geste.fois}
          regard={!depart}
        />
        <div className="animate-[rise_220ms_var(--ease-pose)_200ms_both] space-y-3">
          <h1 id={idTitre} className="titre-lieu text-[1.75rem] leading-tight lg:text-[2.5rem]">
            {insecables('Bonjour, moi c’est Plumio !')}
          </h1>
          <p id={idTexte} className="text-muted text-[1.05rem] leading-relaxed">
            {insecables(
              'Bienvenue sur Tripora. Je vais vous montrer comment préparer un voyage entre amis. Une minute, promis.',
            )}
          </p>
        </div>
        <div className="animate-[rise_220ms_var(--ease-pose)_320ms_both] flex w-full flex-col gap-2 sm:w-auto sm:min-w-64">
          <button
            ref={commencer}
            type="button"
            onClick={() => partir('commencer')}
            className={classesDeBouton({ size: 'lg', block: true })}
          >
            C’est parti
          </button>
          <button
            type="button"
            onClick={() => partir('passer')}
            className={classesDeBouton({ variant: 'ghost', size: 'md', block: true })}
          >
            Passer
          </button>
        </div>
      </div>
    </dialog>
  );
}
