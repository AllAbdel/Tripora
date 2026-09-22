import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Compass } from 'lucide-react';
import { findDestination } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { TitreDePage } from '@/components/TitreDePage';
import { CarteOuverte } from '@/components/CarteOuverte';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { getTripsOuverts } from '@/lib/tripsOuverts';
import { ListeFantome } from '@/components/ui/Squelette';

/**
 * Les voyages d'inconnus qu'on peut rejoindre.
 *
 * L'appariement est strict, et c'est voulu : **même destination, même point de
 * départ**. On ne propose pas Bali au départ de Lyon à quelqu'un qui part de
 * Paris — ce serait proposer un voyage qu'il ne fera pas. L'écran part donc
 * du voyage qu'on a déjà créé, et cherche ceux qui lui ressemblent.
 *
 * La liste ne montre que ce qu'on peut rejoindre. Afficher un voyage réservé
 * aux femmes dans les résultats d'un homme, assorti d'un « vous ne pouvez
 * pas », serait une façon de narguer les gens. La base applique la même règle,
 * de sorte que ce n'est pas seulement une politesse d'affichage.
 */
export default function TripsOuverts() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ouverts = getTripsOuverts();

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });

  const destinationId = voyage.data?.lockedDestinationId ?? null;
  const iata = useMemo(() => voyage.data?.constraints.origin.iata ?? [], [voyage.data]);

  const resultats = useQuery({
    queryKey: ['trips-ouverts', destinationId, iata.join(',')],
    queryFn: () => ouverts.chercher(destinationId!, iata),
    enabled: Boolean(destinationId) && iata.length > 0,
    staleTime: 60 * 1000,
  });

  const ville = destinationId ? findDestination(destinationId) : undefined;

  return (
    <div className="pb-10">
      <div className="px-5 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="text-muted hover:text-brand-600 -ms-1 mb-2 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </button>
      </div>

      <div className="px-5 pb-4">
        <TitreDePage pastille="participants">Partir avec d’autres</TitreDePage>
        {ville && (
          <p className="text-muted mt-1 text-sm">
            Des voyages vers {ville.name}, au départ de {voyage.data?.constraints.origin.name}
          </p>
        )}
      </div>

      <div className="space-y-5 px-5">
        {!destinationId && (
          <Banner tone="info">
            Arrêtez d’abord votre destination. C’est elle, avec votre point de départ, qui permet
            de vous rapprocher de gens qui font le même voyage.
          </Banner>
        )}

        {destinationId && iata.length === 0 && (
          <Banner tone="info">
            Votre point de départ n’a pas d’aéroport connu : sans lui, impossible de savoir qui
            prend le même avion que vous.
          </Banner>
        )}

        {resultats.isLoading && <ListeFantome lignes={3} />}

        {resultats.data?.length === 0 && (
          <EmptyState
            illustration={<Compass className="size-6" aria-hidden />}
            title="Personne pour l’instant"
            description={`Aucun voyage ouvert vers ${ville?.name ?? 'cette destination'} au départ de ${voyage.data?.constraints.origin.name ?? 'chez vous'}. Publiez le vôtre : c’est comme ça qu’on se trouve.`}
            action={
              voyage.data?.isOwner ?
                <Button onClick={() => navigate(`/voyages/${id}/publier`)}>Publier mon trip</Button>
              : undefined
            }
          />
        )}

        {resultats.data?.map((trip) => (
          <CarteOuverte key={trip.tripId} trip={trip} />
        ))}
      </div>
    </div>
  );
}
