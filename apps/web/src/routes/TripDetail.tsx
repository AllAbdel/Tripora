import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getTripRepository } from '@/lib/trips';
import { toFailure } from '@/lib/errors';

/**
 * Écran d'un voyage. Pour l'instant il confirme la création et annonce la
 * suite ; les propositions, le vote, l'itinéraire et la carte viennent
 * s'y greffer aux étapes suivantes.
 */
export default function TripDetail() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();

  const { data, isLoading, error } = useQuery({
    queryKey: ['trips', repository.kind],
    queryFn: () => repository.list(),
  });

  const trip = data?.find((entry) => entry.id === id);

  return (
    <div className="space-y-4 px-5 pt-6">
      <Link
        to="/voyages"
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Mes voyages
      </Link>

      {isLoading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
        </div>
      )}

      {error && <Banner tone="warning">{toFailure(error).message}</Banner>}

      {data && !trip && (
        <Banner tone="warning" title="Voyage introuvable">
          Ce voyage n’existe plus, ou vous n’y avez pas accès.
        </Banner>
      )}

      {trip && (
        <>
          <h1 className="text-2xl font-bold tracking-tight">{trip.title}</h1>

          <Card>
            <CardBody className="space-y-3">
              <p className="font-semibold">Voyage créé.</p>
              <p className="text-muted text-sm leading-relaxed">
                Les prochaines étapes du développement viendront se brancher ici :
                inviter vos amis et recueillir leurs envies, comparer des destinations
                chiffrées, voter, puis obtenir l’itinéraire et la carte.
              </p>
              <Link to="/voyages">
                <Button variant="secondary" block>
                  Revenir à mes voyages
                </Button>
              </Link>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
