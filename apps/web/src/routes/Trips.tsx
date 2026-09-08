import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Plus, Users } from 'lucide-react';
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
import { ListeFantome } from '@/components/ui/Squelette';

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

  const { data, isLoading, error } = useQuery({
    queryKey: ['trips', repository.kind],
    queryFn: () => repository.list(),
  });

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

        {data && data.length > 0 && (
          <ul className="animate-cascade space-y-3">
            {data.map((trip) => (
              <li key={trip.id}>
                <TripCard trip={trip} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function TripCard({ trip }: { trip: TripSummary }) {
  return (
    <Link to={`/voyages/${trip.id}`} className="block">
      <Card className="pressable">
        <CardBody className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{trip.title}</h2>
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
