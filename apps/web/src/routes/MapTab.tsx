import { Link, Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Map as MapIcon } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { getTripRepository } from '@/lib/trips';

/**
 * L'onglet Carte n'a de sens que rapporté à un voyage. Avec un seul voyage on
 * y va directement ; avec plusieurs on demande lequel, plutôt que de deviner.
 */
export default function MapTab() {
  const repository = getTripRepository();
  const { data, isLoading } = useQuery({
    queryKey: ['trips', repository.kind],
    queryFn: () => repository.list(),
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <>
        <ScreenHeader title="Carte" />
        <EmptyState
          illustration={<MapIcon className="text-muted size-12" aria-hidden />}
          title="Aucun voyage à afficher"
          description="La carte montre d’où vous partez et où vous pourriez aller. Créez un voyage pour la voir se remplir."
          action={
            <Link to="/voyages/nouveau">
              <Button>Créer un voyage</Button>
            </Link>
          }
        />
      </>
    );
  }

  if (data.length === 1) return <Navigate to={`/voyages/${data[0]!.id}/carte`} replace />;

  return (
    <>
      <ScreenHeader title="Carte" subtitle="Quel voyage ?" />
      <ul className="space-y-3 px-5">
        {data.map((trip) => (
          <li key={trip.id}>
            <Link to={`/voyages/${trip.id}/carte`} className="block">
              <Card className="transition-transform active:scale-[0.99]">
                <CardBody className="flex items-center gap-3 p-4">
                  <MapIcon className="text-brand-500 size-5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-semibold">{trip.title}</span>
                  <span className="text-muted shrink-0" aria-hidden>›</span>
                </CardBody>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
