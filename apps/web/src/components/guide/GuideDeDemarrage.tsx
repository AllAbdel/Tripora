import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Pastille } from '@/components/Pastille';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { insecables } from '@/lib/typographie';
import { ETAPES_DU_GUIDE } from './etapesDuGuide';

/** Au-delà de ce déplacement horizontal, un glissement change d'écran. */
const SEUIL_DU_GLISSEMENT = 56;

/**
 * Le guide de démarrage : six écrans, qu'on fait défiler ou qu'on passe.
 *
 * Plein écran sur un téléphone, une fiche au milieu sur un ordinateur. On
 * avance avec le bouton, un glissement du doigt ou les flèches du clavier ;
 * « Passer » et Échap le ferment à tout moment. Fermé, il ne revient pas de
 * lui-même (voir `stores/guide.ts`).
 *
 * Écrit avec `<dialog>` : le navigateur donne le fond modal, le piège au
 * clavier et l'annonce au lecteur d'écran.
 */
export default function GuideDeDemarrage({ surFermer }: { surFermer: () => void }) {
  const boite = useRef<HTMLDialogElement | null>(null);
  const depart = useRef<number | null>(null);
  const [rang, setRang] = useState(0);
  const total = ETAPES_DU_GUIDE.length;
  const etape = ETAPES_DU_GUIDE[rang]!;
  const derniere = rang === total - 1;

  useEffect(() => {
    const element = boite.current;
    // `showModal` manque aux environnements de test les plus anciens : la
    // boîte s'affiche alors sans fond modal, ce qui suffit à la vérifier.
    if (element && !element.open && typeof element.showModal === 'function') element.showModal();
    return () => {
      if (element?.open && typeof element.close === 'function') element.close();
    };
  }, []);

  const suivant = () => (derniere ? surFermer() : setRang((valeur) => valeur + 1));
  const precedent = () => setRang((valeur) => Math.max(0, valeur - 1));

  function surAppui(evenement: PointerEvent) {
    depart.current = evenement.clientX;
  }

  function surRelache(evenement: PointerEvent) {
    if (depart.current === null) return;
    const ecart = evenement.clientX - depart.current;
    depart.current = null;
    if (ecart <= -SEUIL_DU_GLISSEMENT && !derniere) setRang((valeur) => valeur + 1);
    if (ecart >= SEUIL_DU_GLISSEMENT) precedent();
  }

  return (
    <dialog
      ref={boite}
      aria-labelledby="titre-du-guide"
      onCancel={(evenement) => {
        evenement.preventDefault();
        surFermer();
      }}
      onKeyDown={(evenement) => {
        if (evenement.key === 'ArrowRight' && !derniere) setRang((valeur) => valeur + 1);
        if (evenement.key === 'ArrowLeft') precedent();
      }}
      className={cn(
        'bg-surface text-ink m-0 h-dvh max-h-none w-screen max-w-none p-0',
        'sm:m-auto sm:h-auto sm:max-h-[min(44rem,calc(100dvh-3rem))] sm:w-[min(30rem,calc(100vw-3rem))] sm:rounded-[var(--radius-card)]',
        'backdrop:bg-black/55 backdrop:backdrop-blur-sm',
      )}
    >
      <div
        className="flex h-full flex-col"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
        onPointerDown={surAppui}
        onPointerUp={surRelache}
        onPointerCancel={() => (depart.current = null)}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="etiquette chiffres" aria-live="polite">
            {rang + 1} sur {total}
          </p>
          <button
            type="button"
            onClick={surFermer}
            className="text-muted hover:text-brand-600 min-h-11 px-2 text-sm font-semibold"
          >
            Passer
          </button>
        </div>

        {/* La clé rejoue l'entrée à chaque écran : sans elle, le texte
            changerait sur place, sans que l'œil voie qu'on a avancé. */}
        <div key={rang} className="animate-rise flex flex-1 flex-col gap-6 overflow-y-auto px-6 pt-8 pb-6">
          <Pastille nom={etape.pastille} taille="lg" />
          <div className="space-y-3">
            <p className="etiquette">{etape.etiquette}</p>
            <h2 id="titre-du-guide" className="titre-lieu text-[2rem] leading-[1.05]">
              {insecables(etape.titre)}
            </h2>
            <p className="text-muted leading-relaxed">{insecables(etape.texte)}</p>
          </div>
          <ul className="space-y-3">
            {etape.gestes.map((geste) => (
              <li key={geste} className="flex gap-3 text-[0.95rem] leading-snug">
                <Check className="text-brand-600 dark:text-brand-300 mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{insecables(geste)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4 px-5 pb-5" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.25rem)' }}>
          <div className="flex justify-center gap-1.5" aria-hidden>
            {ETAPES_DU_GUIDE.map((_, index) => (
              <span
                key={index}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  index === rang ? 'bg-brand-500 w-6' : 'w-1.5 bg-[color:var(--border-fort)]',
                )}
              />
            ))}
          </div>
          <div className="flex gap-2.5">
            {rang > 0 && (
              <Button
                variant="ghost"
                onClick={precedent}
                aria-label="Écran précédent"
                icon={<ArrowLeft className="size-5" aria-hidden />}
              />
            )}
            <Button
              block
              size="lg"
              autoFocus
              onClick={suivant}
              className="flex-1"
            >
              {derniere ? 'C’est parti' : 'Suivant'}
              {!derniere && <ArrowRight className="size-5" aria-hidden />}
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
