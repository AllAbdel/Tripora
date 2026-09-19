import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle } from 'lucide-react';
import { etatDuServeur } from '@/lib/ai';
import { presenterLeService } from '@/lib/services';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * Le serveur répond-il ?
 *
 * Ce bloc existe à cause d'une panne qui a duré deux semaines sans que rien
 * ne la signale. Une règle de partage d'origine incomplète faisait refuser
 * par le navigateur *tous* les appels aux fonctions serveur — les prix de
 * vol, la météo, l'assistant, les lieux — avant même qu'ils ne partent.
 *
 * Tripora est conçu pour se dégrader proprement : sans prix relevé il affiche
 * ses estimations, sans assistant il masque la saisie en langage naturel.
 * Cette qualité s'est retournée contre nous. Chaque écran disait « montants
 * estimés », ce qui est le message normal quand aucune source n'est branchée,
 * et rien nulle part ne distinguait « le serveur n'a pas de clé » de « le
 * navigateur n'a jamais laissé partir l'appel ». Les deux se ressemblent
 * parfaitement, vus de l'écran.
 *
 * D'où cette ligne, et son unique sonde : la tâche `status` de la fonction
 * `ai` ne consomme ni quota ni modèle, et une règle d'origine casse toutes
 * les fonctions d'un coup — savoir que celle-ci répond suffit donc à savoir
 * que les autres le peuvent.
 *
 * Ce qu'il ne fait pas : alerter quand tout va bien. Un voyage en mode local
 * n'a pas de serveur, et c'est un choix, pas une panne.
 */

const TONS = {
  ok: {
    icone: CheckCircle2,
    couleur: 'text-lagoon-600 dark:text-lagoon-300',
    bordure: 'border-[color:var(--border-subtle)]',
  },
  neutre: {
    icone: MinusCircle,
    couleur: 'text-muted',
    bordure: 'border-[color:var(--border-subtle)]',
  },
  alerte: {
    icone: AlertTriangle,
    couleur: 'text-gold-700 dark:text-gold-300',
    bordure: 'border-gold-500/50',
  },
} as const;

export function EtatDesServices() {
  const etat = useQuery({
    queryKey: ['etat-du-serveur'],
    queryFn: etatDuServeur,
    // Une panne se répare : on redemande à chaque ouverture de l'écran, mais
    // pas en boucle, et jamais avec insistance — ce n'est pas une supervision.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: false,
  });

  if (etat.isLoading) {
    return (
      <Card>
        <CardBody className="text-muted flex items-center gap-2.5 text-sm">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          Vérification…
        </CardBody>
      </Card>
    );
  }

  const presentation = presenterLeService(etat.data ?? { statut: 'injoignable' });
  const { icone: Icone, couleur, bordure } = TONS[presentation.ton];

  return (
    <Card className={cn('border', bordure)}>
      <CardBody className="flex items-start gap-2.5">
        <Icone className={cn('mt-0.5 size-4 shrink-0', couleur)} aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{presentation.titre}</p>
          <p className="text-muted text-sm leading-relaxed">{presentation.detail}</p>
        </div>
      </CardBody>
    </Card>
  );
}
