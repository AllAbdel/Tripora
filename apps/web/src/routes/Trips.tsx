import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { useT } from '@/i18n/useT';
import { Pastille } from '@/components/Pastille';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth-context';
import { getTripRepository, type TripSummary } from '@/lib/trips';
import { toFailure } from '@/lib/errors';
import { CarteDeVoyage } from '@/components/CarteDeVoyage';
import { ListeFantome } from '@/components/ui/Squelette';
import { LigneGlissante } from '@/components/LigneGlissante';
import { ConfirmerSuppression } from '@/components/ConfirmerSuppression';
import { basculerFavori, favorisEnTete, listerFavoris } from '@/lib/favoris';
import { signaler } from '@/lib/feedback';

export default function Trips() {
  const { identity, backendReady } = useAuth();
  const t = useT();
  const repository = getTripRepository();
  const queryClient = useQueryClient();
  const [aSupprimer, setASupprimer] = useState<TripSummary | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['trips', repository.kind],
    queryFn: () => repository.list(),
  });

  const favoris = useQuery({
    queryKey: ['favoris', repository.kind],
    queryFn: () => listerFavoris(),
    staleTime: 5 * 60 * 1000,
  });

  const epingler = useMutation({
    mutationFn: ({ id, epingle }: { id: string; epingle: boolean }) =>
      basculerFavori(id, epingle),
    onMutate: async ({ id, epingle }) => {
      // Bascule optimiste : l'épingle doit répondre au doigt, pas au réseau.
      await queryClient.cancelQueries({ queryKey: ['favoris', repository.kind] });
      const avant = queryClient.getQueryData<readonly string[]>(['favoris', repository.kind]);
      const apres = epingle
        ? [...new Set([...(avant ?? []), id])]
        : (avant ?? []).filter((entree) => entree !== id);
      queryClient.setQueryData(['favoris', repository.kind], apres);
      signaler(epingle ? 'reussite' : 'tape');
      return { avant };
    },
    onError: (_erreur, _variables, contexte) => {
      queryClient.setQueryData(['favoris', repository.kind], contexte?.avant ?? []);
      signaler('echec');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['favoris', repository.kind] });
    },
  });

  const supprimer = useMutation({
    mutationFn: (id: string) => repository.remove(id),
    onSuccess: () => {
      signaler('decision');
      setASupprimer(null);
      void queryClient.invalidateQueries({ queryKey: ['trips', repository.kind] });
    },
    onError: () => signaler('echec'),
  });

  // L'ensemble se reconstruit ici, à partir du tableau qui a traversé le
  // cache : c'est la forme commode pour interroger, pas pour conserver.
  const epingles = useMemo(() => new Set(favoris.data ?? []), [favoris.data]);
  const listeTriee = data ? favorisEnTete(data, epingles) : undefined;

  return (
    <>
      <ScreenHeader
        title={t('trips.titre')}
        pastille="voyages"
        subtitle={identity ? `Bonjour ${identity.displayName}` : undefined}
        action={
          <Link to="/voyages/nouveau" aria-label={t('action.creer')}>
            <Button size="sm" icon={<Plus className="size-4" aria-hidden />}>
              {t('action.nouveau')}
            </Button>
          </Link>
        }
      />

      <div className="space-y-4 px-5">
        {!backendReady && (
          <Banner tone="warning" title="Ces voyages ne vivent que sur cet appareil">
            Rien n’est envoyé sur un serveur : personne ne peut les rejoindre, ils ne suivent pas
            d’un téléphone à l’autre, et vider les données du navigateur les efface
            définitivement. C’est parfait pour essayer, risqué pour un vrai voyage.
          </Banner>
        )}

        {error && (
          <Banner tone="warning" title="Chargement impossible">
            {toFailure(error).message}
          </Banner>
        )}

        {isLoading && <ListeFantome combien={2} lignes={1} />}


        {data && data.length === 0 && (
          <EmptyState
            illustration={<Logo className="size-16 opacity-90" />}
            title={t('trips.vide.titre')}
            description={t('trips.vide.texte')}
            action={
              <Link to="/voyages/nouveau">
                <Button size="lg" icon={<Plus className="size-5" aria-hidden />}>
                  {t('action.creer')}
                </Button>
              </Link>
            }
          />
        )}

        {listeTriee && listeTriee.length > 0 && (
          <>
            <ul className="animate-cascade space-y-3">
              {listeTriee.map((trip) => (
                <li key={trip.id}>
                  <LigneGlissante
                    libelle={trip.title}
                    epingle={epingles.has(trip.id)}
                    surEpingler={() =>
                      epingler.mutate({ id: trip.id, epingle: !epingles.has(trip.id) })
                    }
                    surSupprimer={() => setASupprimer(trip)}
                  >
                    <CarteDeVoyage trip={trip} epingle={epingles.has(trip.id)} />
                  </LigneGlissante>
                </li>
              ))}
            </ul>
            <p className="text-muted pb-2 text-center text-xs">
              Glissez une carte vers la gauche pour la supprimer, vers la droite pour
              l’épingler.
            </p>
          </>
        )}

        {/* Seulement avec un serveur : sans lui, il n'y a pas d'inconnus à
            rejoindre, et la porte mènerait à un écran vide. */}
        {backendReady && data && <PorteDesTripsOuverts />}
      </div>

      <ConfirmerSuppression
        voyage={aSupprimer}
        enCours={supprimer.isPending}
        surAnnuler={() => setASupprimer(null)}
        surConfirmer={() => aSupprimer && supprimer.mutate(aSupprimer.id)}
      />
    </>
  );
}

/**
 * L'entrée vers les trips des autres.
 *
 * Sous la liste, pas au-dessus : les voyages qu'on organise restent le sujet
 * de l'écran. Mais sans cette entrée, la seule manière de trouver le trip de
 * quelqu'un d'autre était de créer d'abord le sien — ce qui n'a aucun sens
 * pour qui cherche justement à rejoindre.
 */
function PorteDesTripsOuverts() {
  return (
    <Link
      to="/explorer"
      className="pressable filet surface-raised flex items-center gap-3 rounded-[var(--radius-card)]
                 border p-4"
    >
      <Pastille nom="ouvert" taille="sm" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Partir avec d’autres</span>
        <span className="text-muted block text-sm">
          Rejoindre un trip publié par des gens qui font le même trajet
        </span>
      </span>
      <ArrowRight className="text-muted size-4 shrink-0 rtl:rotate-180" aria-hidden />
    </Link>
  );
}
