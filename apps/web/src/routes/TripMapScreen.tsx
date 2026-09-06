import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { buildProposals, findDestination, formatCents } from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { TripMap, type MapMarker } from '@/components/TripMap';
import { buildTripMarkers } from '@/lib/mapMarkers';
import { getTripRepository } from '@/lib/trips';
import { useGroupRealtime } from '@/lib/useGroupRealtime';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';

/**
 * La géographie du voyage : d'où l'on part, où l'on pourrait aller, et à quelle
 * distance. Une liste de villes ne dit rien de la carte ; voir Budapest et
 * Lisbonne côte à côte, avec le point de départ, change la conversation.
 */
export default function TripMapScreen() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();
  const [selection, setSelection] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', repository.kind, id],
    queryFn: () => repository.get(id!),
    enabled: Boolean(id),
  });
  useGroupRealtime(id);

  const proposals = useMemo(() => {
    if (!data) return null;
    return buildProposals(data.constraints, data.members, { keep: 6 });
  }, [data]);

  const retenue = data?.lockedDestinationId ?? null;

  const markers = useMemo<MapMarker[]>(() => {
    if (!data || !proposals) return [];
    return buildTripMarkers({
      origin: data.constraints.origin,
      scores: proposals.scores,
      lockedDestinationId: retenue,
      onSelect: setSelection,
    });
  }, [data, proposals, retenue]);

  const trajet = useMemo(() => {
    if (!data) return null;
    const cible = retenue ?? selection;
    const destination = cible ? findDestination(cible) : undefined;
    return destination
      ? ([data.constraints.origin, destination] as [typeof data.constraints.origin, typeof destination])
      : null;
  }, [data, retenue, selection]);

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Retour id={id} />
        <Banner tone="warning">
          {error ? toFailure(error).message : 'Ce voyage n’existe plus, ou vous n’y avez pas accès.'}
        </Banner>
      </div>
    );
  }

  const choisie = selection ? proposals?.scores.find((s) => s.destinationId === selection) : null;
  const villeChoisie = selection ? findDestination(selection) : null;

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <div className="px-5 pt-6 pb-3">
        <Retour id={id} />
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{data.summary.title}</h1>
        <p className="text-muted text-sm">
          {retenue
            ? `Vous partez à ${findDestination(retenue)?.name}`
            : `${markers.length - 1} destination${markers.length > 2 ? 's' : ''} en lice`}
        </p>
      </div>

      <div className="relative mx-5 min-h-80 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-subtle)]">
        <TripMap markers={markers} route={trajet} className="absolute inset-0" />
      </div>

      {!retenue && (
        <p className="text-muted px-5 pt-3 text-center text-xs">
          Touchez un repère pour voir la destination et son trajet depuis{' '}
          {data.constraints.origin.name}.
        </p>
      )}

      {villeChoisie && choisie && (
        <div className="animate-rise px-5 pt-3">
          <Card>
            <CardBody className="flex items-center gap-3 p-4">
              <MapPin className="text-brand-500 size-5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{villeChoisie.name}</p>
                <p className="text-muted text-sm">
                  {villeChoisie.country} ·{' '}
                  {formatCents(choisie.cost.totalCents, 'EUR', { hideCentimes: true })} par personne
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
                  'bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200',
                )}
              >
                {choisie.total}
              </span>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

function Retour({ id }: { id: string | undefined }) {
  return (
    <Link
      to={`/voyages/${id ?? ''}`}
      className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Retour au voyage
    </Link>
  );
}
