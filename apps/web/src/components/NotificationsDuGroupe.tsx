import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Mascotte } from '@/components/mascotte/Mascotte';
import { Card, CardBody } from '@/components/ui/Card';
import { NotificationsDeCetAppareil } from '@/components/NotificationsDeCetAppareil';
import {
  CLE_DE_L_ETAT_DES_NOTIFICATIONS,
  activerLesNotifications,
  etatDesNotifications,
  messageDesAlertes,
} from '@/lib/alertesDePrix';
import { toFailure } from '@/lib/errors';
import {
  CATEGORIES,
  CLE_DES_REGLAGES,
  REGLAGES_PAR_DEFAUT,
  enregistrerMesReglages,
  requeteDesReglages,
  type ReglagesDeNotification,
} from '@/lib/notificationsDuGroupe';

/**
 * Les notifications du groupe, dans le profil : cet appareil, puis ce qu'on
 * veut recevoir, catégorie par catégorie. Les catégories valent pour tous les
 * appareils abonnés ; elles s'enregistrent au geste, sans bouton.
 */
export function NotificationsDuGroupe() {
  const queryClient = useQueryClient();
  const reglages = useQuery(requeteDesReglages());
  const changer = useMutation({
    mutationFn: enregistrerMesReglages,
    // Une case cochée se voit tout de suite ; un échec la remet comme avant.
    onMutate: async (suivants: ReglagesDeNotification) => {
      await queryClient.cancelQueries({ queryKey: CLE_DES_REGLAGES });
      const avant = queryClient.getQueryData<ReglagesDeNotification | null>(CLE_DES_REGLAGES);
      queryClient.setQueryData(CLE_DES_REGLAGES, suivants);
      return { avant };
    },
    onError: (_erreur, _suivants, contexte) => queryClient.setQueryData(CLE_DES_REGLAGES, contexte?.avant ?? null),
  });

  const actuels = reglages.data ?? REGLAGES_PAR_DEFAUT;

  return (
    <div className="space-y-3">
      <NotificationsDeCetAppareil
        explication="Un message, une dépense, une arrivée, une décision : ce qui se passe dans vos voyages, sans rouvrir Tripora. Le contenu est chiffré pour cet appareil ; le service de notification de votre navigateur ne peut pas le lire."
        dansLApplication="Dans l’application, les notifications du groupe ne sont pas encore disponibles. Ouvrez Tripora dans votre navigateur (Chrome sur Android, ou depuis l’icône de l’écran d’accueil sur iPhone) et activez-les depuis le profil."
      />
      <Card>
        <CardBody className="space-y-3">
          <fieldset className="space-y-1">
            <legend className="mb-2 text-sm font-semibold">Me prévenir pour</legend>
            {CATEGORIES.map((categorie) => (
              <label key={categorie.cle} className="flex min-h-11 items-start gap-3 py-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={actuels[categorie.cle]}
                  onChange={(evenement) => changer.mutate({ ...actuels, [categorie.cle]: evenement.target.checked })}
                  className="accent-brand-500 mt-0.5 size-5 shrink-0"
                />
                <span className="space-y-0.5">
                  <span className="block font-medium">{categorie.titre}</span>
                  <span className="text-muted block text-xs leading-relaxed">{categorie.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-muted text-xs leading-relaxed">
            Sur tous vos appareils abonnés, et jamais pour ce que vous faites vous-même. Les votes restent anonymes :
            une notification ne dit jamais qui a voté quoi.
          </p>
          {changer.error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {toFailure(changer.error).message}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * La proposition, là où elle a du sens : dans la discussion, tant que cet
 * appareil n'est pas abonné et qu'on n'a pas coupé les messages. Rien à
 * l'ouverture d'une page : la permission ne se demande qu'au geste.
 */
export function PropositionDeNotifications() {
  const queryClient = useQueryClient();
  const reglages = useQuery(requeteDesReglages());
  const etat = useQuery({ queryKey: CLE_DE_L_ETAT_DES_NOTIFICATIONS, queryFn: etatDesNotifications });
  const activer = useMutation({
    mutationFn: activerLesNotifications,
    onSuccess: (nouvelEtat) => queryClient.setQueryData(CLE_DE_L_ETAT_DES_NOTIFICATIONS, nouvelEtat),
  });

  if (!reglages.data?.discussion || etat.data !== 'a-demander' || activer.data === 'refusees') return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <Mascotte pose="notification" taille={48} joue />
      <span className="text-muted">Être prévenu des nouveaux messages, application fermée ?</span>
      <Button
        size="sm"
        variant="secondary"
        loading={activer.isPending}
        icon={<Bell className="size-4" aria-hidden />}
        onClick={() => activer.mutate()}
      >
        Me prévenir
      </Button>
      {activer.error && (
        <p role="alert" className="w-full text-sm text-red-700 dark:text-red-300">
          {messageDesAlertes(activer.error)}
        </p>
      )}
    </div>
  );
}
