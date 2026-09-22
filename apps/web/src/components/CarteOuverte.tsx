import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { findDestination, MONTHS_FR } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { ConditionsDuTrip } from '@/components/ConditionsDuTrip';
import { getTripsOuverts, lireLErreur, type TripOuvert } from '@/lib/tripsOuverts';
import { signaler } from '@/lib/feedback';

/**
 * La fiche d'un trip ouvert dans une liste, avec sa candidature repliée.
 *
 * Partagée par la recherche depuis un voyage et par l'exploration libre : deux
 * fiches différentes pour le même trip finiraient par ne plus dire la même
 * chose de ses conditions.
 */
export function CarteOuverte({ trip }: { trip: TripOuvert }) {
  const [ouverte, setOuverte] = useState(false);
  const ville = findDestination(trip.destinationId);

  return (
    <article className="surface-raised rounded-[var(--radius-card)] border filet p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="titre truncate text-lg">{trip.titre}</h2>
        <span className="etiquette shrink-0">
          {trip.dureeJours} jour{trip.dureeJours > 1 ? 's' : ''}
        </span>
      </header>

      <p className="text-muted mt-0.5 text-sm">
        {ville?.name}
        {trip.moisCible ? ` · ${MONTHS_FR[trip.moisCible - 1]}` : ''} · départ de {trip.origineNom}
      </p>

      <p className="mt-3 text-sm leading-relaxed">{trip.resume}</p>

      <div className="mt-4">
        <ConditionsDuTrip trip={trip} />
      </div>

      {ouverte ?
        <Postuler trip={trip} onFini={() => setOuverte(false)} />
      : <Button className="mt-4" block onClick={() => setOuverte(true)}>
          Me présenter
        </Button>
      }
    </article>
  );
}

/**
 * La candidature.
 *
 * La longueur minimale est fixée par l'organisateur, et le compteur la montre
 * en direct : personne ne doit découvrir au moment d'envoyer que sa phrase ne
 * suffisait pas.
 */
function Postuler({ trip, onFini }: { trip: TripOuvert; onFini: () => void }) {
  const [texte, setTexte] = useState('');
  const queryClient = useQueryClient();
  const ouverts = getTripsOuverts();

  const envoyer = useMutation({
    mutationFn: () => ouverts.postuler(trip.tripId, texte),
    onSuccess: (suite) => {
      signaler(suite === 'acceptee' ? 'decision' : 'tape');
      void queryClient.invalidateQueries({ queryKey: ['trips-ouverts'] });
      void queryClient.invalidateQueries({ queryKey: ['trip'] });
      onFini();
    },
    onError: () => signaler('echec'),
  });

  const manque = trip.presentationMinimum - texte.trim().length;

  return (
    <div className="mt-4 space-y-3">
      <label className="block space-y-1.5">
        <span className="etiquette etiquette-filet">Votre présentation</span>
        <textarea
          value={texte}
          onChange={(event) => setTexte(event.target.value)}
          rows={4}
          maxLength={1000}
          autoFocus
          placeholder="Qui vous êtes, ce que vous cherchez, comment vous voyagez."
          className="surface-raised w-full rounded-[var(--radius-card)] border filet p-3
                     text-[16px] outline-none focus:border-brand-500"
        />
      </label>

      <p className="text-muted text-xs">
        {manque > 0 ?
          `Encore ${manque} caractère${manque > 1 ? 's' : ''} — l’organisateur en demande ${trip.presentationMinimum} au minimum.`
        : trip.validation === 'auto' ?
          'Vous rejoindrez le voyage immédiatement.'
        : 'L’organisateur lira votre message et vous répondra.'}
      </p>

      {envoyer.error && <Banner tone="warning">{lireLErreur(envoyer.error)}</Banner>}

      <div className="flex gap-2">
        <Button
          block
          disabled={manque > 0}
          loading={envoyer.isPending}
          icon={envoyer.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          onClick={() => envoyer.mutate()}
        >
          Envoyer
        </Button>
        <Button variant="ghost" onClick={onFini}>
          Annuler
        </Button>
      </div>
    </div>
  );
}
