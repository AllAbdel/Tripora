import type { ReactNode } from 'react';
import { Link, Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ScreenHeader } from '@/components/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { getTripRepository } from '@/lib/trips';

/**
 * Un onglet du bas qui n'a de sens que rapporté à un voyage.
 *
 * Avec un seul voyage on y va directement — demander « lequel ? » quand il n'y
 * a qu'une réponse est une friction gratuite. Avec plusieurs, on demande,
 * plutôt que de deviner et d'ouvrir le mauvais.
 */
export function TripPickerTab({
  title,
  sousChemin,
  icone,
  descriptionVide,
}: {
  title: string;
  /** Segment ajouté après /voyages/:id, par exemple « carte ». */
  sousChemin: string;
  icone: ReactNode;
  descriptionVide: string;
}) {
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
        <ScreenHeader title={title} />
        <EmptyState
          illustration={icone}
          title="Aucun voyage à afficher"
          description={descriptionVide}
          action={
            <Link to="/voyages/nouveau">
              <Button>Créer un voyage</Button>
            </Link>
          }
        />
      </>
    );
  }

  if (data.length === 1) {
    return <Navigate to={`/voyages/${data[0]!.id}/${sousChemin}`} replace />;
  }

  return (
    <>
      <ScreenHeader title={title} subtitle="Quel voyage ?" />
      <ul className="space-y-3 px-5">
        {data.map((trip) => (
          <li key={trip.id}>
            <Link to={`/voyages/${trip.id}/${sousChemin}`} className="block">
              <Card className="transition-transform active:scale-[0.99]">
                <CardBody className="flex items-center gap-3 p-4">
                  <span className="shrink-0" aria-hidden>{icone}</span>
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
