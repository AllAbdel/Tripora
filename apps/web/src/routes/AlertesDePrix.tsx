import { localeActive } from '@tripora/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, BellRing, TrendingDown } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListeFantome } from '@/components/ui/Squelette';
import { useTitreDuDocument } from '@/lib/useTitreDuDocument';
import { estNatif } from '@/lib/natif';
import {
  CLE_DES_ALERTES,
  CLE_DES_SUIVIS,
  activerLesNotifications,
  alertesPossibles,
  arreterDeSuivre,
  couperLesNotifications,
  etatDesNotifications,
  euros,
  libelleDuMois,
  marquerCommeVues,
  messageDesAlertes,
  ouEnEstLePrix,
  requeteDesAlertes,
  requeteDesSuivis,
  type AlerteDePrix,
  type SuiviDePrix,
} from '@/lib/alertesDePrix';

/**
 * Les vols suivis, et ce que leurs prix ont fait.
 *
 * On y arrive par une notification (« un prix que vous suivez a baissé »),
 * par le profil, ou depuis la ligne « Prix suivi » d'une proposition. Les
 * baisses d'abord — c'est ce qu'on vient voir —, puis les trajets suivis,
 * puis le réglage des notifications de cet appareil.
 */
export default function AlertesDePrix() {
  useTitreDuDocument('Alertes de prix — Tripora');
  const queryClient = useQueryClient();
  const alertes = useQuery(requeteDesAlertes());
  const suivis = useQuery(requeteDesSuivis());

  // Les baisses pas encore vues restent marquées « nouveau » pendant la
  // visite, même une fois signalées comme lues au serveur : sinon la marque
  // disparaîtrait avant qu'on ait eu le temps de la lire.
  const [nouvelles, setNouvelles] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const aMarquer = (alertes.data ?? []).filter((alerte) => alerte.vueLe === null).map((alerte) => alerte.id);
    if (aMarquer.length === 0) return;
    void marquerCommeVues(aMarquer)
      .then(() => {
        setNouvelles((avant) => new Set([...avant, ...aMarquer]));
        const maintenant = new Date().toISOString();
        queryClient.setQueryData<AlerteDePrix[]>(CLE_DES_ALERTES, (avant) =>
          avant?.map((alerte) => (aMarquer.includes(alerte.id) ? { ...alerte, vueLe: maintenant } : alerte)),
        );
      })
      .catch(() => undefined);
  }, [alertes.data, queryClient]);

  const arreter = useMutation({
    mutationFn: (id: string) => arreterDeSuivre(id),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: CLE_DES_SUIVIS }),
        queryClient.invalidateQueries({ queryKey: CLE_DES_ALERTES }),
      ]),
  });

  if (!alertesPossibles) {
    return (
      <>
        <ScreenHeader title="Alertes de prix" />
        <EmptyState
          title="Les alertes demandent Tripora en ligne"
          description="Le prix des vols est relevé chaque matin par le serveur de Tripora. Sur cette installation, il n’y en a pas."
        />
      </>
    );
  }

  const chargement = alertes.isLoading || suivis.isLoading;
  const listeDesSuivis = suivis.data ?? [];
  const listeDesAlertes = alertes.data ?? [];

  return (
    <>
      <ScreenHeader title="Alertes de prix" subtitle="Les vols que vous suivez, relevés chaque matin." />

      <div className="space-y-6 px-5 pb-4">
        {chargement ? (
          <ListeFantome combien={3} lignes={2} />
        ) : (
          <>
            {(alertes.error ?? suivis.error) && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {messageDesAlertes(alertes.error ?? suivis.error)}
              </p>
            )}

            {listeDesAlertes.length > 0 && (
              <section className="space-y-2" aria-labelledby="baisses">
                <h2 id="baisses" className="etiquette px-1">
                  Baisses récentes
                </h2>
                <ul className="animate-cascade space-y-2">
                  {listeDesAlertes.map((alerte) => (
                    <li key={alerte.id}>
                      <LigneDAlerte alerte={alerte} nouvelle={alerte.vueLe === null || nouvelles.has(alerte.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2" aria-labelledby="suivis">
              <h2 id="suivis" className="etiquette px-1">
                Prix suivis
              </h2>
              {listeDesSuivis.length === 0 ? (
                <Card>
                  <EmptyState
                    illustration={<Bell className="text-muted size-8" aria-hidden />}
                    title="Aucun prix suivi"
                    description="Dans un voyage, ouvrez le détail d’une proposition : « Suivre le prix du vol » se trouve sous « Comment y aller »."
                  />
                </Card>
              ) : (
                <ul className="space-y-2">
                  {listeDesSuivis.map((suivi) => (
                    <li key={suivi.id}>
                      <LigneDeSuivi
                        suivi={suivi}
                        enArret={arreter.isPending && arreter.variables === suivi.id}
                        onArreter={() => arreter.mutate(suivi.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {arreter.error && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                  {messageDesAlertes(arreter.error)}
                </p>
              )}
            </section>
          </>
        )}

        <section className="space-y-2" aria-labelledby="notifications">
          <h2 id="notifications" className="etiquette px-1">
            Sur cet appareil
          </h2>
          <NotificationsDeCetAppareil />
        </section>
      </div>
    </>
  );
}

function LigneDAlerte({ alerte, nouvelle }: { alerte: AlerteDePrix; nouvelle: boolean }) {
  const quand = new Date(alerte.creeLe).toLocaleDateString(localeActive(), { day: 'numeric', month: 'long' });
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <TrendingDown className="text-lagoon-600 dark:text-lagoon-300 mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
            <span className="titre-lieu text-base">{alerte.destinationNom}</span>
            <span className="text-muted font-normal">
              {alerte.origine} · {libelleDuMois(alerte.mois)}
            </span>
            {nouvelle && (
              <span className="bg-lagoon-50 text-lagoon-700 dark:bg-lagoon-900/40 dark:text-lagoon-200 rounded px-1.5 text-xs font-semibold">
                Nouveau
              </span>
            )}
          </p>
          <p className="text-sm">
            <span className="chiffres font-semibold">{euros(alerte.nouveauCents)}</span> au lieu de{' '}
            <span className="chiffres">{euros(alerte.ancienCents)}</span>
            <span className="text-muted"> · relevé le {quand}</span>
          </p>
          {alerte.tripId && (
            <Link
              to={`/voyages/${alerte.tripId}`}
              className="text-brand-600 dark:text-brand-300 inline-flex min-h-10 items-center text-sm font-semibold"
            >
              Voir le voyage
            </Link>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function LigneDeSuivi({
  suivi,
  enArret,
  onArreter,
}: {
  suivi: SuiviDePrix;
  enArret: boolean;
  onArreter: () => void;
}) {
  const plusBasAutreQueLeDernier =
    suivi.plusBasCents !== null && suivi.dernierCents !== null && suivi.plusBasCents < suivi.dernierCents;
  return (
    <Card>
      <CardBody className="space-y-1.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold">
          <span className="titre-lieu text-base">{suivi.destinationNom}</span>
          <span className="text-muted font-normal">
            depuis {suivi.origine} · {libelleDuMois(suivi.mois)}
          </span>
        </p>
        <p className="text-muted text-sm">{ouEnEstLePrix(suivi)}</p>
        {plusBasAutreQueLeDernier && (
          <p className="text-muted text-xs">Le plus bas relevé : {euros(suivi.plusBasCents!)}.</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4">
          {suivi.tripId && (
            <Link
              to={`/voyages/${suivi.tripId}`}
              className="text-brand-600 dark:text-brand-300 inline-flex min-h-10 items-center text-sm font-semibold"
            >
              Voir le voyage
            </Link>
          )}
          <button
            type="button"
            onClick={onArreter}
            disabled={enArret}
            className="text-muted inline-flex min-h-10 items-center text-sm underline disabled:opacity-60"
          >
            {enArret ? 'Arrêt…' : 'Arrêter le suivi'}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Les notifications de ce navigateur. La permission n'est demandée qu'au
 * geste : demandée d'office, elle est refusée, et le refus est définitif.
 */
function NotificationsDeCetAppareil() {
  const queryClient = useQueryClient();
  const etat = useQuery({ queryKey: ['etat-des-notifications'], queryFn: etatDesNotifications });
  const basculer = useMutation({
    mutationFn: async (activer: boolean) => {
      if (activer) return activerLesNotifications();
      await couperLesNotifications();
      return 'a-demander' as const;
    },
    onSuccess: (nouvelEtat) => queryClient.setQueryData(['etat-des-notifications'], nouvelEtat),
  });

  if (etat.isLoading) return null;

  if (etat.data === 'impossibles') {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <BellOff className="text-muted mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-muted text-sm leading-relaxed">
            {estNatif
              ? 'Dans l’application, les baisses s’affichent ici et sur l’écran du voyage. Pour être prévenu application fermée, ouvrez Tripora dans Chrome et activez les notifications depuis cet écran.'
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
            <p className="text-muted text-sm leading-relaxed">
              Une notification quand un prix suivi baisse d’au moins 10 % et d’au moins 15 €. Elle
              ne contient ni destination ni prix : rien de personnel ne passe par le service de
              notification de votre navigateur.
            </p>
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
