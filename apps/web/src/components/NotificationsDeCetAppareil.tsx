import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { estNatif } from '@/lib/natif';
import {
  CLE_DE_L_ETAT_DES_NOTIFICATIONS,
  activerLesNotifications,
  couperLesNotifications,
  etatDesNotifications,
  messageDesAlertes,
} from '@/lib/alertesDePrix';

/**
 * Les notifications de ce navigateur. La permission n'est demandée qu'au
 * geste : demandée d'office, elle est refusée, et le refus est définitif.
 *
 * Un seul abonnement par appareil, pour tout ce que Tripora peut dire (une
 * baisse de prix, ce qui se passe dans un voyage) : l'écran qui l'affiche ne
 * change que l'explication.
 */
export function NotificationsDeCetAppareil({
  explication,
  dansLApplication,
}: {
  explication: string;
  /** Ce qu'on dit dans l'application mobile, dont la vue web ne reçoit rien. */
  dansLApplication: string;
}) {
  const queryClient = useQueryClient();
  const etat = useQuery({ queryKey: CLE_DE_L_ETAT_DES_NOTIFICATIONS, queryFn: etatDesNotifications });
  const basculer = useMutation({
    mutationFn: async (activer: boolean) => {
      if (activer) return activerLesNotifications();
      await couperLesNotifications();
      return 'a-demander' as const;
    },
    onSuccess: (nouvelEtat) => queryClient.setQueryData(CLE_DE_L_ETAT_DES_NOTIFICATIONS, nouvelEtat),
  });

  if (etat.isLoading) return null;

  if (etat.data === 'impossibles') {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <BellOff className="text-muted mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-muted text-sm leading-relaxed">
            {estNatif
              ? dansLApplication
              : 'Ce navigateur ne reçoit pas de notifications de site. Sur iPhone, ajoutez d’abord Tripora à l’écran d’accueil (Partager › Sur l’écran d’accueil), puis revenez ici depuis l’icône.'}
          </p>
        </CardBody>
      </Card>
    );
  }

  const actives = etat.data === 'actives';
  const refusees = etat.data === 'refusees' || basculer.data === 'refusees';

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          {actives ? (
            <BellRing className="text-brand-500 mt-0.5 size-5 shrink-0" aria-hidden />
          ) : (
            <BellOff className="text-muted mt-0.5 size-5 shrink-0" aria-hidden />
          )}
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {actives ? 'Vous êtes prévenu sur cet appareil' : 'Pas de notification sur cet appareil'}
            </p>
            <p className="text-muted text-sm leading-relaxed">{explication}</p>
          </div>
        </div>
        {refusees && !actives ? (
          <p className="text-gold-700 dark:text-gold-300 text-sm" role="status">
            Les notifications de Tripora sont bloquées dans ce navigateur : autorisez-les dans les
            réglages du site, puis revenez ici.
          </p>
        ) : (
          <Button
            variant={actives ? 'secondary' : 'primary'}
            block
            loading={basculer.isPending}
            icon={actives ? undefined : <Bell className="size-4" aria-hidden />}
            onClick={() => basculer.mutate(!actives)}
          >
            {actives ? 'Couper sur cet appareil' : 'Me prévenir sur cet appareil'}
          </Button>
        )}
        {basculer.error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {messageDesAlertes(basculer.error)}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
