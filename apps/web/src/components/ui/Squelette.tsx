import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * La silhouette d'un contenu qui arrive.
 *
 * Un rond qui tourne dit « attendez » ; une silhouette dit « voilà ce qui
 * arrive, et où ». La différence n'est pas cosmétique : l'écran se met en place
 * une seule fois au lieu de sauter d'un état vide à un état plein, et l'attente
 * paraît plus courte parce qu'elle est déjà occupée.
 *
 * L'onde est lente et continue, jamais un clignotement — un clignotement attire
 * l'œil précisément sur ce qui n'est pas encore là. Elle s'arrête d'elle-même
 * quand le système demande moins de mouvement : la règle est dans la feuille de
 * style, pas ici.
 */
export function Ligne({ className }: { className?: string }) {
  return <span className={cn('squelette block h-3 rounded-full', className)} aria-hidden />;
}

/** Une carte de voyage ou de destination, en attendant la vraie. */
export function CarteFantome({ lignes = 2 }: { lignes?: number }) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="squelette size-11 shrink-0 rounded-xl" aria-hidden />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Ligne className="w-2/5" />
            <Ligne className="h-2.5 w-1/4" />
          </div>
          <span className="squelette size-11 shrink-0 rounded-full" aria-hidden />
        </div>
        {Array.from({ length: lignes }, (_, rang) => (
          <Ligne key={rang} className={cn('h-2.5', rang === lignes - 1 ? 'w-3/5' : 'w-full')} />
        ))}
      </CardBody>
    </Card>
  );
}

/**
 * Plusieurs silhouettes, décalées.
 *
 * `aria-busy` et le libellé portent l'information pour les lecteurs d'écran :
 * les formes elles-mêmes sont muettes, sinon l'attente se lirait à voix haute
 * comme une suite de blocs vides.
 */
export function ListeFantome({ combien = 3, lignes = 2 }: { combien?: number; lignes?: number }) {
  return (
    <div className="animate-cascade space-y-3" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: combien }, (_, rang) => (
        <CarteFantome key={rang} lignes={lignes} />
      ))}
    </div>
  );
}
