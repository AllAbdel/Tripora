import { useNavigate } from 'react-router';
import {
  ArrowRight,
  CalendarDays,
  ListChecks,
  Lock,
  ThumbsUp,
  UserPlus,
} from 'lucide-react';
import { prochainGeste, type CibleGeste, type Geste, type Readiness } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * Une seule chose à faire, en haut du voyage.
 *
 * L'écran disait déjà tout ce qui manquait, et c'était honnête : une liste de
 * quatre lignes, chacune avec sa conséquence. Sauf qu'une liste ne se fait pas
 * faire. Quelqu'un qui ouvre l'application veut savoir quoi faire dans les
 * trois secondes, pas auditer l'avancement du groupe.
 *
 * D'où ce bloc : un geste, une raison, un bouton. Le reste n'a pas disparu —
 * il est replié juste en dessous, dans « Où on en est ».
 *
 * Le geste est plus visible quand il m'incombe que quand j'attends les autres.
 * Un écran qui crie « agis ! » alors qu'il n'y a rien à faire de mon côté use
 * son crédit pour la fois où il y en aura vraiment.
 */
/**
 * Une icône par intention, plutôt qu'un pictogramme unique.
 *
 * L'étincelle qui figurait ici disait « magie » — c'est-à-dire exactement ce
 * que Tripora ne fait pas : rien de cet écran n'est décidé par un modèle. Une
 * icône qui décrit l'action est aussi plus utile : elle se reconnaît avant que
 * le titre soit lu.
 */
const ICONES: Record<CibleGeste, typeof ArrowRight> = {
  'mes-envies': ListChecks,
  participants: UserPlus,
  propositions: ThumbsUp,
  trancher: Lock,
  itineraire: CalendarDays,
};

export function ProchainGeste({
  tripId,
  readiness,
  jAiRepondu,
  jAiVote,
  jeSuisOrganisateur,
  destinationArretee,
  itineraireVide,
  collaborationPossible,
  propositions,
}: {
  tripId: string;
  readiness: Readiness;
  jAiRepondu: boolean;
  jAiVote: boolean;
  jeSuisOrganisateur: boolean;
  destinationArretee: boolean;
  itineraireVide: boolean;
  collaborationPossible: boolean;
  propositions: number;
}) {
  const naviguer = useNavigate();

  const geste = prochainGeste({
    readiness,
    jAiRepondu,
    jAiVote,
    jeSuisOrganisateur,
    destinationArretee,
    itineraireVide,
    collaborationPossible,
    propositions,
  });

  if (!geste) return null;
  const Icone = ICONES[geste.cible];

  return (
    <Card
      className={cn(
        'animate-rise',
        // Un liseré, pas un aplat : le bloc doit se remarquer sans écraser les
        // propositions, qui restent le contenu de l'écran.
        geste.personnel && 'border-brand-500 shadow-[var(--shadow-float)]',
      )}
    >
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-xl',
              geste.personnel
                ? 'bg-brand-500 text-[color:var(--accent-contrast)]'
                : 'bg-[color:var(--surface-muted)] text-muted',
            )}
          >
            <Icone className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">{geste.titre}</h2>
            <p className="text-muted mt-0.5 text-sm leading-relaxed">{geste.pourquoi}</p>
          </div>
        </div>

        <Button
          block
          variant={geste.personnel ? 'primary' : 'secondary'}
          icon={<ArrowRight className="size-4" aria-hidden />}
          onClick={() => {
            signaler('tape');
            allerVers(geste, tripId, naviguer);
          }}
        >
          {geste.libelle}
        </Button>
      </CardBody>
    </Card>
  );
}

/**
 * Traduit l'intention du noyau en déplacement réel.
 *
 * Deux cibles sont sur cet écran-ci : on y descend plutôt que d'y naviguer,
 * sans quoi le bouton semblerait ne rien faire. Le défilement est doux, sauf
 * si le système demande moins de mouvement.
 */
function allerVers(geste: Geste, tripId: string, naviguer: (to: string) => void): void {
  const ROUTES: Partial<Record<CibleGeste, string>> = {
    'mes-envies': `/voyages/${tripId}/mes-envies`,
    participants: `/voyages/${tripId}/participants`,
    itineraire: `/voyages/${tripId}/itineraire`,
  };

  const route = ROUTES[geste.cible];
  if (route) {
    naviguer(route);
    return;
  }

  const ancre = document.getElementById(
    geste.cible === 'trancher' ? 'trancher' : 'propositions',
  );
  ancre?.scrollIntoView({
    behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
    block: 'start',
  });
}
