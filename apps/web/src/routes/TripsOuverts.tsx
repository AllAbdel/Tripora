import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Compass, Loader2, Send } from 'lucide-react';
import { findDestination, MONTHS_FR } from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { TitreDePage } from '@/components/TitreDePage';
import { ConditionsDuTrip } from '@/components/ConditionsDuTrip';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { getTripsOuverts, lireLErreur, type TripOuvert } from '@/lib/tripsOuverts';
import { signaler } from '@/lib/feedback';
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

function CarteOuverte({ trip }: { trip: TripOuvert }) {
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
