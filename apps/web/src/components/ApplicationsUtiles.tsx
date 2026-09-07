import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Smartphone } from 'lucide-react';
import { essentielles, type Destination } from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { FicheApplication } from '@/components/FicheApplication';
import { getApps } from '@/lib/apps';

/**
 * Ce qu'il faut installer avant de partir, sur l'aperçu du voyage.
 *
 * L'encart ne montre que quelques applications — une par rubrique, les plus
 * locales d'abord. Le catalogue entier est à un lien de là. Le pari est qu'une
 * courte liste se lit et se suit, là où trente fiches se referment.
 *
 * Il n'apparaît qu'une fois la destination arrêtée : « installez Grab » ne
 * veut rien dire tant que le groupe hésite entre Bangkok et Porto.
 */
export function ApplicationsUtiles({
  tripId,
  destination,
}: {
  tripId: string;
  destination: Destination;
}) {
  const api = getApps();

  const catalogue = useQuery({
    queryKey: ['applications-publiees'],
    queryFn: () => api!.listPublished(),
    enabled: Boolean(api),
    // Le catalogue bouge de quelques lignes par mois : le relire à chaque
    // ouverture d'écran serait un aller-retour pour rien.
    staleTime: 30 * 60 * 1000,
  });

  const tete = essentielles(catalogue.data ?? [], {
    destinationId: destination.id,
    countryCode: destination.countryCode,
  });

  if (tete.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="bg-brand-500/15 text-brand-600 dark:text-brand-300 grid size-10 shrink-0 place-items-center rounded-xl"
          >
            <Smartphone className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">À installer avant de partir</h3>
            <p className="text-muted text-sm">
              Ce que les habitués de {destination.name} ont sur leur téléphone.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {tete.map((app) => (
            <FicheApplication key={app.id} app={app} portee={app.portee} />
          ))}
        </div>

        <Link
          to={`/voyages/${tripId}/applications`}
          className="text-brand-600 dark:text-brand-300 inline-flex min-h-11 items-center text-sm font-semibold"
        >
          Voir toutes les applications utiles
        </Link>
      </CardBody>
    </Card>
  );
}
