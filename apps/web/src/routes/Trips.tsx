import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Plus, Star, Users } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth-context';
import { getTripRepository, type TripSummary } from '@/lib/trips';
import { toFailure } from '@/lib/errors';
import { Drapeau } from '@/components/Drapeau';
import { cn } from '@/lib/cn';
import { ListeFantome } from '@/components/ui/Squelette';
import { LigneGlissante } from '@/components/LigneGlissante';
import { ConfirmerSuppression } from '@/components/ConfirmerSuppression';
import { basculerFavori, favorisEnTete, listerFavoris } from '@/lib/favoris';
import { signaler } from '@/lib/feedback';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  proposing: 'Recherche de destinations',
  voting: 'Vote en cours',
  planned: 'Destination choisie',
  ongoing: 'En cours',
  done: 'Terminé',
};

export default function Trips() {
  const { identity, backendReady } = useAuth();
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
      const avant = queryClient.getQueryData<ReadonlySet<string>>(['favoris', repository.kind]);
      const apres = new Set(avant ?? []);
      if (epingle) apres.add(id);
      else apres.delete(id);
      queryClient.setQueryData(['favoris', repository.kind], apres as ReadonlySet<string>);
      signaler(epingle ? 'reussite' : 'tape');
      return { avant };
    },
    onError: (_erreur, _variables, contexte) => {
      queryClient.setQueryData(['favoris', repository.kind], contexte?.avant ?? new Set());
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

  const epingles = favoris.data ?? new Set<string>();
  const listeTriee = data ? favorisEnTete(data, epingles) : undefined;

  return (
    <>
      <ScreenHeader
        title="Mes voyages"
        subtitle={identity ? `Bonjour ${identity.displayName}` : undefined}
        action={
          <Link to="/voyages/nouveau" aria-label="Créer un voyage">
            <Button size="sm" icon={<Plus className="size-4" aria-hidden />}>
              Nouveau
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
            title="Aucun voyage pour l’instant"
            description="Créez un voyage, invitez vos amis, et laissez chacun dire son budget et ses envies. Tripora compare les destinations et explique ses prix."
            action={
              <Link to="/voyages/nouveau">
                <Button size="lg" icon={<Plus className="size-5" aria-hidden />}>
                  Créer un voyage
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
                    <TripCard trip={trip} epingle={epingles.has(trip.id)} />
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

function TripCard({ trip, epingle }: { trip: TripSummary; epingle: boolean }) {
  return (
    <Link to={`/voyages/${trip.id}`} className="block">
      <Card className={cn('pressable', epingle && 'border-gold-500')}>
        <CardBody className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-lg font-semibold">
              {epingle && (
                <Star className="text-gold-500 size-4 shrink-0 fill-current" aria-label="Épinglé" />
              )}
              <span className="truncate">{trip.title}</span>
            </h2>
            <span className="text-brand-700 dark:text-brand-200 bg-brand-50 dark:bg-brand-900/50 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium">
              {STATUS_LABELS[trip.status] ?? trip.status}
            </span>
          </div>
          <p className="text-muted flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              {trip.participants} {trip.participants > 1 ? 'participants' : 'participant'}
            </span>
            {trip.destinationName && (
              <span className="inline-flex items-center gap-1.5">
                {trip.destinationCountryCode ? (
                  <Drapeau code={trip.destinationCountryCode} />
                ) : (
                  <MapPin className="size-3.5" aria-hidden />
                )}
                {trip.destinationName}
              </span>
            )}
            {trip.localOnly && <span className="text-xs">· sur cet appareil</span>}
          </p>
        </CardBody>
      </Card>
    </Link>
  );
}
