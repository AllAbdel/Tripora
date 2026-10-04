import { useMemo } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellRing } from 'lucide-react';
import type { Destination, TripConstraints } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import {
  CLE_DES_SUIVIS,
  alertesPossibles,
  arreterDeSuivre,
  libelleDuMois,
  memeTrajet,
  messageDesAlertes,
  ouEnEstLePrix,
  requeteDesSuivis,
  suivreLePrix,
  trajetDuVoyage,
} from '@/lib/alertesDePrix';

/**
 * « Suivre le prix de ce vol » : un geste, puis Tripora relève le prix chaque
 * matin et prévient quand il baisse vraiment.
 *
 * Deux habits : une ligne sous « Comment y aller » dans chaque proposition, et
 * une carte pour la destination retenue, où la question du billet devient
 * concrète. Tous deux lisent la même liste de suivis : suivre ici se voit là.
 */
export function SuivreLePrix({
  tripId,
  constraints,
  destination,
  enCarte = false,
}: {
  tripId: string;
  constraints: TripConstraints;
  destination: Pick<Destination, 'id' | 'name' | 'iata'>;
  enCarte?: boolean;
}) {
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const trajet = useMemo(
    () => trajetDuVoyage(tripId, constraints, destination),
    [tripId, constraints, destination],
  );
  const actif = alertesPossibles && identity?.mode === 'supabase' && trajet !== null;
  const suivis = useQuery(requeteDesSuivis(actif));
  const suivi = trajet ? suivis.data?.find((candidat) => memeTrajet(candidat, trajet)) : undefined;

  const suivre = useMutation({
    mutationFn: () => suivreLePrix(trajet!, identity!.id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLE_DES_SUIVIS }),
  });
  const arreter = useMutation({
    mutationFn: (id: string) => arreterDeSuivre(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLE_DES_SUIVIS }),
  });

  if (!actif || !trajet || suivis.isLoading) return null;

  const erreur = suivre.error ?? arreter.error;
  const mois = libelleDuMois(trajet.mois);

  const contenu = suivi ? (
    <div className="space-y-2">
      <p className="flex items-start gap-2 text-sm">
        <BellRing className="text-lagoon-600 dark:text-lagoon-300 mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">
            Prix suivi, {trajet.origine} → {destination.name} en {mois}.
          </span>{' '}
          <span className="text-muted">{ouEnEstLePrix(suivi)}</span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-x-4 ps-6">
        <Link
          to="/alertes"
          className="text-brand-600 dark:text-brand-300 inline-flex min-h-10 items-center text-sm font-semibold"
        >
          Mes alertes de prix
        </Link>
        <button
          type="button"
          onClick={() => arreter.mutate(suivi.id)}
          disabled={arreter.isPending}
          className="text-muted inline-flex min-h-10 items-center text-sm underline disabled:opacity-60"
        >
          {arreter.isPending ? 'Arrêt…' : 'Arrêter le suivi'}
        </button>
      </div>
    </div>
  ) : (
    <div className="space-y-1.5">
      <Button
        size="sm"
        variant="secondary"
        loading={suivre.isPending}
        icon={<Bell className="size-4" aria-hidden />}
        onClick={() => suivre.mutate()}
      >
        Suivre le prix du vol
      </Button>
      <p className="text-muted text-xs leading-relaxed">
        {trajet.origine} → {destination.name} en {mois}. Tripora relève le prix chaque matin
        et vous prévient s’il baisse d’au moins 10 %.
      </p>
    </div>
  );

  const message = erreur ? (
    <p role="alert" className="text-sm text-red-700 dark:text-red-300">
      {messageDesAlertes(erreur)}
    </p>
  ) : null;

  if (!enCarte) {
    return (
      <div className="filet space-y-2 border-t pt-2.5">
        {contenu}
        {message}
      </div>
    );
  }

  return (
    <Card className="animate-rise">
      <CardBody className="space-y-3">
        <p className="etiquette">Le prix du vol</p>
        {contenu}
        {message}
      </CardBody>
    </Card>
  );
}
