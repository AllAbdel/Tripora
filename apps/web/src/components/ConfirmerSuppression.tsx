import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { TripSummary } from '@/lib/trips';

/**
 * La confirmation avant de supprimer un voyage.
 *
 * Un glissement de deux centimètres ne doit pas effacer trois semaines de
 * préparation à plusieurs. La confirmation est donc obligatoire, y compris
 * quand l'action vient du geste — surtout quand elle vient du geste, en fait,
 * parce qu'un geste part parfois tout seul en faisant défiler la liste.
 *
 * Écrit avec `<dialog>` plutôt qu'avec une pile de div : le navigateur donne
 * gratuitement le fond modal, le piège au clavier, la fermeture par Échap et
 * l'annonce au lecteur d'écran.
 */
export function ConfirmerSuppression({
  voyage,
  enCours,
  surAnnuler,
  surConfirmer,
}: {
  voyage: TripSummary | null;
  enCours: boolean;
  surAnnuler: () => void;
  surConfirmer: () => void;
}) {
  const boite = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const element = boite.current;
    if (!element) return;
    if (voyage && !element.open) element.showModal();
    if (!voyage && element.open) element.close();
  }, [voyage]);

  return (
    <dialog
      ref={boite}
      onCancel={(evenement) => {
        evenement.preventDefault();
        surAnnuler();
      }}
      onClose={surAnnuler}
      className="bg-surface text-ink w-[min(26rem,calc(100vw-2.5rem))] rounded-[var(--radius-card)] p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      {voyage && (
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold">Supprimer « {voyage.title} » ?</h2>
              <p className="text-muted mt-1 text-sm">
                {voyage.localOnly
                  ? 'Ce voyage ne vit que sur cet appareil : rien ne permettra de le retrouver.'
                  : 'Le voyage disparaît pour tout le groupe, avec ses votes, son itinéraire et ses dépenses. Cette action ne s’annule pas.'}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5">
            <Button variant="ghost" className="flex-1" onClick={surAnnuler} disabled={enCours}>
              Annuler
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={surConfirmer}
              disabled={enCours}
            >
              {enCours ? 'Suppression…' : 'Supprimer'}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
