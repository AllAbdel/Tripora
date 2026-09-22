import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Compass, MapPin, PlaneTakeoff, X } from 'lucide-react';
import {
  findDestination,
  searchDestinations,
  searchOrigins,
  type Destination,
  type Place,
} from '@tripora/core';
import { TitreDePage } from '@/components/TitreDePage';
import { Banner } from '@/components/ui/Banner';
import { TextInput } from '@/components/ui/Field';
import { CarteOuverte } from '@/components/CarteOuverte';
import { useAuth } from '@/lib/auth-context';
import { getTripsOuverts, type MaCandidature, type SuiteCandidature } from '@/lib/tripsOuverts';
import { cn } from '@/lib/cn';

/**
 * Explorer les trips ouverts, sans avoir créé le sien.
 *
 * Jusqu'ici, pour trouver le voyage de quelqu'un d'autre, il fallait d'abord
 * créer le sien — assistant de six étapes compris — parce que la recherche
 * partait d'un voyage existant. C'est absurde pour la personne qui veut
 * justement *rejoindre* : elle n'a rien à organiser, elle cherche un groupe.
 *
 * Ici on ne demande que ce que la règle d'appariement exige : d'où l'on part
 * et où l'on veut aller. Rien n'est enregistré ; le choix vit dans l'adresse
 * de la page, pour qu'une recherche se partage et se retrouve.
 *
 * Et en tête, les candidatures en cours : on doit pouvoir savoir où en est ce
 * qu'on a envoyé sans avoir à se souvenir d'où on l'a envoyé.
 */
export default function Explorer() {
  const navigate = useNavigate();
  const { identity } = useAuth();
  const ouverts = getTripsOuverts();

  const parametres = useMemo(() => new URLSearchParams(window.location.search), []);
  const [depart, setDepart] = useState<Place | null>(() => {
    const nom = parametres.get('depart');
    return nom ? (searchOrigins(nom, 20).find((place) => place.name === nom) ?? null) : null;
  });
  const [destination, setDestination] = useState<Destination | null>(() => {
    const id = parametres.get('vers');
    return id ? (findDestination(id) ?? null) : null;
  });

  // L'adresse suit le choix, sans ajouter d'entrée à l'historique : revenir en
  // arrière doit ramener à l'écran précédent, pas à la recherche d'avant.
  const garder = (nouveauDepart: Place | null, nouvelleDestination: Destination | null) => {
    const suite = new URLSearchParams();
    if (nouveauDepart) suite.set('depart', nouveauDepart.name);
    if (nouvelleDestination) suite.set('vers', nouvelleDestination.id);
    const chaine = suite.toString();
    window.history.replaceState(null, '', chaine ? `?${chaine}` : window.location.pathname);
  };

  const iata = depart?.iata ?? [];
  const resultats = useQuery({
    queryKey: ['trips-ouverts', destination?.id ?? null, iata.join(',')],
    queryFn: () => ouverts.chercher(destination!.id, iata),
    enabled: Boolean(destination) && iata.length > 0,
    staleTime: 60 * 1000,
  });

  const anonyme = identity?.isAnonymous ?? false;

  return (
    <div className="pb-16">
      <div className="px-5 pt-6">
        <button
          onClick={() => navigate(-1)}
          className="text-muted hover:text-brand-600 -ms-1 mb-2 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour
        </button>
        <TitreDePage pastille="ouvert">Partir avec d’autres</TitreDePage>
        <p className="text-muted mt-1 text-sm">
          Des trips publiés par des gens qui partent du même endroit que vous, vers le même
          endroit.
        </p>
      </div>

      <div className="space-y-6 px-5 pt-5">
        {anonyme && (
          <Banner tone="info">
            Vous êtes connecté en invité. Vous pouvez regarder ; pour vous présenter à des
            inconnus, il faut un compte — c’est la moindre des choses envers eux.
          </Banner>
        )}

        {!anonyme && <MesCandidatures />}

        <section className="space-y-3">
          <h2 className="etiquette etiquette-filet">Votre trajet</h2>
          <Choisir
            libelle="Je pars de"
            icone={<PlaneTakeoff className="size-4" aria-hidden />}
            valeur={depart?.name ?? null}
            chercher={(texte) => searchOrigins(texte, 6).map((place) => ({ cle: place.name, nom: place.name, detail: place.iata?.[0] ?? '' }))}
            onChoisir={(nom) => {
              const choisi = searchOrigins(nom, 20).find((place) => place.name === nom) ?? null;
              setDepart(choisi);
              garder(choisi, destination);
            }}
            onEffacer={() => {
              setDepart(null);
              garder(null, destination);
            }}
          />
          <Choisir
            libelle="Je vais à"
            icone={<MapPin className="size-4" aria-hidden />}
            valeur={destination?.name ?? null}
            chercher={(texte) => searchDestinations(texte, 6).map((ville) => ({ cle: ville.id, nom: ville.name, detail: ville.country }))}
            onChoisir={(id) => {
              const choisie = findDestination(id) ?? null;
              setDestination(choisie);
              garder(depart, choisie);
            }}
            onEffacer={() => {
              setDestination(null);
              garder(depart, null);
            }}
          />
          {depart && iata.length === 0 && (
            <p className="text-muted text-xs">
              {depart.name} n’a pas d’aéroport connu : sans lui, impossible de savoir qui prend le
              même avion que vous.
            </p>
          )}
        </section>

        {resultats.data?.length === 0 && (
          <div className="py-6 text-center">
            <Compass className="text-muted mx-auto size-6" aria-hidden />
            <p className="titre mt-3 text-lg">Personne pour l’instant</p>
            <p className="text-muted mx-auto mt-1 max-w-xs text-sm">
              Aucun trip ouvert de {depart?.name} vers {destination?.name}. Créez le vôtre et
              publiez-le : c’est comme ça qu’on se trouve.
            </p>
            <Link
              to="/voyages/nouveau"
              className="text-brand-600 dark:text-brand-300 mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline"
            >
              Créer un trip
            </Link>
          </div>
        )}

        {resultats.data && resultats.data.length > 0 && (
          <section className="space-y-4">
            <h2 className="etiquette etiquette-filet">
              {resultats.data.length} trip{resultats.data.length > 1 ? 's' : ''} ouvert
              {resultats.data.length > 1 ? 's' : ''}
            </h2>
            {resultats.data.map((trip) => (
              <CarteOuverte key={trip.tripId} trip={trip} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Un champ qui propose au fil de la frappe, et qui se replie en étiquette une
 * fois le choix fait. On ne tape jamais un nom libre : la recherche a besoin
 * d'un code d'aéroport ou d'un identifiant de destination, pas d'un texte.
 */
function Choisir({
  libelle,
  icone,
  valeur,
  chercher,
  onChoisir,
  onEffacer,
}: {
  libelle: string;
  icone: React.ReactNode;
  valeur: string | null;
  chercher: (texte: string) => { cle: string; nom: string; detail: string }[];
  onChoisir: (cle: string) => void;
  onEffacer: () => void;
}) {
  const [texte, setTexte] = useState('');
  const propositions = useMemo(() => (texte.trim() ? chercher(texte) : []), [texte, chercher]);

  if (valeur) {
    return (
      <div className="surface-raised flex items-center gap-3 rounded-[var(--radius-card)] border filet px-4 py-3">
        <span className="text-muted">{icone}</span>
        <span className="min-w-0 flex-1">
          <span className="etiquette block">{libelle}</span>
          <span className="block truncate font-semibold">{valeur}</span>
        </span>
        <button
          type="button"
          onClick={onEffacer}
          aria-label={`Changer : ${libelle.toLowerCase()}`}
          className="text-muted hover:text-brand-600 grid size-9 place-items-center rounded-full"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="relative block">
        <span className="text-muted pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2">
          {icone}
        </span>
        <TextInput
          value={texte}
          onChange={(event) => setTexte(event.target.value)}
          placeholder={libelle}
          aria-label={libelle}
          className="ps-10"
        />
      </label>
      {propositions.length > 0 && (
        <ul className="surface-raised overflow-hidden rounded-[var(--radius-card)] border filet">
          {propositions.map((proposition) => (
            <li key={proposition.cle}>
              <button
                type="button"
                onClick={() => {
                  onChoisir(proposition.cle);
                  setTexte('');
                }}
                className="filet flex w-full items-baseline justify-between gap-3 border-b px-4 py-2.5
                           text-start last:border-b-0 hover:bg-[color:var(--surface-muted)]"
              >
                <span className="truncate">{proposition.nom}</span>
                <span className="text-muted shrink-0 text-xs">{proposition.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SUITES: Record<SuiteCandidature, { texte: string; ton: string }> = {
  'en-attente': { texte: 'En attente', ton: 'text-gold-700 dark:text-gold-300' },
  acceptee: { texte: 'Acceptée', ton: 'text-brand-600 dark:text-brand-300' },
  refusee: { texte: 'Non retenue', ton: 'text-muted' },
  retiree: { texte: 'Retirée', ton: 'text-muted' },
};

/**
 * Ce que j'ai envoyé, et où ça en est.
 *
 * Un refus s'écrit « non retenue » : c'est la même information, et elle se
 * lit mieux quand on vient d'essuyer un non. Une candidature acceptée mène au
 * voyage, qu'on a désormais le droit de voir.
 */
function MesCandidatures() {
  const ouverts = getTripsOuverts();
  const queryClient = useQueryClient();

  const liste = useQuery({
    queryKey: ['mes-candidatures'],
    queryFn: () => ouverts.mesCandidatures(),
    staleTime: 60 * 1000,
  });

  const retirer = useMutation({
    mutationFn: (tripId: string) => ouverts.retirer(tripId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mes-candidatures'] }),
  });

  if (!liste.data || liste.data.length === 0) return null;

  return (
    <section className="space-y-1">
      <h2 className="etiquette etiquette-filet">Mes candidatures</h2>
      <ul>
        {liste.data.map((candidature: MaCandidature) => {
          const suite = SUITES[candidature.suite];
          const ville = findDestination(candidature.destinationId);
          return (
            <li
              key={candidature.tripId}
              className="filet flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
            >
              <span className="min-w-0">
                {candidature.suite === 'acceptee' ?
                  <Link
                    to={`/voyages/${candidature.tripId}`}
                    className="block truncate font-medium underline-offset-2 hover:underline"
                  >
                    {candidature.titre}
                  </Link>
                : <span className="block truncate font-medium">{candidature.titre}</span>}
                <span className="text-muted block text-xs">
                  {ville?.name ?? candidature.destinationId} · depuis {candidature.origineNom}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className={cn('etiquette', suite.ton)}>{suite.texte}</span>
                {candidature.suite === 'en-attente' && (
                  <button
                    type="button"
                    disabled={retirer.isPending}
                    onClick={() => retirer.mutate(candidature.tripId)}
                    className="text-muted text-xs underline-offset-2 hover:underline"
                  >
                    Retirer
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
