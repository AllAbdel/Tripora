import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowLeftRight, ChevronDown, ChevronUp, Loader2, MapPinned, Plus, RotateCcw,
  Trash2, X,
} from 'lucide-react';
import {
  awaitsPlace, AXIS_EMOJI, buildItinerary, dayVerdict, describeDay, fillItinerary,
  findDestination, formatCents, groupWeights, parseAmountToCents, suggestWeatherSwaps,
  weatherEmoji,
  type DailyWeather, type Destination, type MemberPreference, type Poi,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, TextInput } from '@/components/ui/Field';
import { LieuxSuggeres } from '@/components/LieuxSuggeres';
import { EpinglesDuGroupe } from '@/components/EpinglesDuGroupe';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { getTripRepository } from '@/lib/trips';
import {
  getItinerary, positionPourHeure, type ItineraryDayView, type ItineraryItem,
} from '@/lib/itinerary';
import { chargerLieux } from '@/lib/places';
import { chargerMeteo, cleMeteo } from '@/lib/weather';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';

const ICONES: Record<string, string> = {
  transit: '✈️',
  checkin: '🔑',
  checkout: '🧳',
  meal: '🍽️',
  evening: '🌙',
};

export default function TripItinerary() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();
  const itineraire = getItinerary();
  const queryClient = useQueryClient();
  const [jourActif, setJourActif] = useState(1);
  const [ajoutSur, setAjoutSur] = useState<string | null>(null);

  const voyage = useQuery({
    queryKey: ['trip', repository.kind, id],
    queryFn: () => repository.get(id!),
    enabled: Boolean(id),
  });



  const jours = useQuery({
    queryKey: ['itineraire', id],
    queryFn: () => itineraire.load(id!),
    enabled: Boolean(id),
  });

  const destination = voyage.data?.lockedDestinationId
    ? findDestination(voyage.data.lockedDestinationId)
    : null;

  // La même prévision que sur la fiche du voyage, servie par le même cache :
  // ouvrir l'itinéraire ne déclenche pas un second appel.
  const meteo = useQuery({
    queryKey: cleMeteo(destination?.lat ?? 0, destination?.lng ?? 0),
    queryFn: () => chargerMeteo(destination!.lat, destination!.lng),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    enabled: Boolean(destination),
  });

  // Les mêmes lieux que le sélecteur « ajouter un vrai lieu » : une seule
  // requête, un seul cache, trente jours côté serveur.
  const lieux = useQuery({
    queryKey: ['lieux', destination?.id],
    queryFn: () => chargerLieux(destination!),
    staleTime: 24 * 60 * 60 * 1000,
    enabled: Boolean(destination),
  });

  /**
   * Les créneaux encore neutres, et le vrai lieu qui leur irait.
   *
   * On ne touche qu'à ce que personne n'a renseigné : `awaitsPlace` compare au
   * titre neutre, donc un nom écrit par quelqu'un du groupe est intouchable.
   */
  const aCompleter = useMemo(() => {
    const disponibles = lieux.data?.liste ?? [];
    const journees = jours.data;
    if (!journees || disponibles.length === 0) return [];

    const libres = journees.flatMap((jour) =>
      jour.items
        .filter((item) => item.axis !== null && awaitsPlace(item.title, item.axis))
        .map((item) => ({ item, dayIndex: jour.dayIndex })),
    );
    if (libres.length === 0) return [];

    const remplis = fillItinerary({
      slots: libres.map(({ item, dayIndex }) => ({
        dayIndex,
        position: item.position,
        axis: item.axis!,
      })),
      places: disponibles,
      weights: groupWeights(voyage.data?.members ?? []),
    });

    return remplis.flatMap((rempli) => {
      const cible = libres.find(
        ({ item, dayIndex }) => dayIndex === rempli.dayIndex && item.position === rempli.position,
      );
      return cible
        ? [{ itemId: cible.item.id, title: rempli.poi.name, notes: rempli.reason }]
        : [];
    });
  }, [jours.data, lieux.data, voyage.data?.members]);


  /** La prévision indexée par date, pour que chaque jour trouve la sienne. */
  const meteoParJour = useMemo(() => {
    const table = new Map<string, DailyWeather>();
    if (meteo.data?.statut === 'ok') {
      for (const jour of meteo.data.jours) table.set(jour.date, jour);
    }
    return table;
  }, [meteo.data]);

  /** Le plan que produirait le moteur, tant que rien n'est enregistré. */
  const planPropose = useMemo(() => {
    if (!voyage.data || !destination) return null;
    return buildItinerary({
      destination,
      constraints: voyage.data.constraints,
      members: voyage.data.members,
    });
  }, [voyage.data, destination]);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: ['itineraire', id] });

  const generer = useMutation({
    mutationFn: async () => {
      if (!planPropose) throw new Error('Aucune destination arrêtée');
      await itineraire.materialise(id!, planPropose);
    },
    onSuccess: rafraichir,
  });

  const regenerer = useMutation({
    mutationFn: async () => {
      await itineraire.reset(id!);
      if (planPropose) await itineraire.materialise(id!, planPropose);
    },
    onSuccess: rafraichir,
  });

  const supprimer = useMutation({
    mutationFn: (itemId: string) => itineraire.removeItem(itemId),
    onSuccess: rafraichir,
  });

  const completer = useMutation({
    mutationFn: async (choix: { itemId: string; title: string; notes: string }[]) => {
      // Une ligne à la fois : si la connexion lâche au milieu, ce qui est
      // passé reste, et un second clic finira le travail.
      for (const entree of choix) {
        await itineraire.updateItem(entree.itemId, {
          title: entree.title,
          notes: entree.notes,
        });
      }
    },
    onSuccess: rafraichir,
  });

  const deplacer = useMutation({
    mutationFn: ({ item, sens, liste }: { item: ItineraryItem; sens: -1 | 1; liste: ItineraryItem[] }) => {
      const index = liste.findIndex((entree) => entree.id === item.id);
      const cible = index + sens;
      if (cible < 0 || cible >= liste.length) return Promise.resolve();
      // On s'insère entre la voisine visée et celle d'après, dans le sens du geste.
      const avant = sens === -1 ? (liste[cible - 1]?.position ?? null) : liste[cible]!.position;
      const apres = sens === -1 ? liste[cible]!.position : (liste[cible + 1]?.position ?? null);
      return itineraire.moveItem(item.id, avant, apres);
    },
    onSuccess: rafraichir,
  });

  const ajouter = useMutation({
    mutationFn: (entree: {
      dayId: string;
      title: string;
      startTime: string;
      cost: string;
      notes: string | null;
      voisins: ItineraryItem[];
    }) => {
      const heure = entree.startTime || null;
      const position = positionPourHeure(entree.voisins, heure);
      return itineraire.addItem(entree.dayId, {
        title: entree.title.trim(),
        startTime: heure,
        costCents: entree.cost ? parseAmountToCents(entree.cost) : 0,
        // L'adresse d'une épingle suit l'élément : c'est ce qu'on cherche une
        // fois sur place, et la retaper serait la première chose oubliée.
        notes: entree.notes,
        ...(position !== undefined ? { position } : {}),
      });
    },
    onSuccess: () => {
      setAjoutSur(null);
      return rafraichir();
    },
  });

  if (voyage.isLoading || jours.isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="text-brand-500 size-6 animate-spin" aria-label="Chargement" />
      </div>
    );
  }

  if (!voyage.data) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Retour id={id} />
        <Banner tone="warning">Ce voyage n’existe plus, ou vous n’y avez pas accès.</Banner>
      </div>
    );
  }

  if (!destination) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Retour id={id} />
        <h1 className="text-2xl font-bold tracking-tight">Itinéraire</h1>
        <Banner tone="info" title="La destination n’est pas encore arrêtée">
          L’itinéraire se construit autour d’une ville. Votez d’abord, puis revenez ici.
        </Banner>
        <Link to={`/voyages/${id}`}>
          <Button variant="secondary" block>Aller au vote</Button>
        </Link>
      </div>
    );
  }

  const enregistre = jours.data;

  // Le programme d'une journée se lit dans les envies qu'elle sert : c'est ce
  // qui dit si la pluie la gâche ou pas.
  const echanges = suggestWeatherSwaps(
    (enregistre ?? []).map((jour) => ({
      dayIndex: jour.dayIndex,
      date: jour.date ?? undefined,
      axes: jour.items.flatMap((item) => (item.axis ? [item.axis] : [])),
    })),
    meteo.data?.statut === 'ok' ? meteo.data.jours : [],
  );

  return (
    <div className="space-y-4 px-5 pt-6">
      <Retour id={id} />
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{destination.name}</h1>
        <p className="text-muted text-sm">
          {voyage.data.constraints.durationDays} jours · au départ de{' '}
          {voyage.data.constraints.origin.name}
        </p>
      </div>

      {(generer.error || regenerer.error || ajouter.error) && (
        <Banner tone="warning" title="Enregistrement impossible">
          {toFailure(generer.error ?? regenerer.error ?? ajouter.error).message}
        </Banner>
      )}

      {!enregistre && (
        <>
          <Card>
            <CardBody className="space-y-3">
              <p className="font-semibold">Construire l’itinéraire</p>
              <p className="text-muted text-sm leading-relaxed">
                Tripora propose la structure du séjour — quel type de moment, quel jour, à
                quelle heure, avec quelle enveloppe — en réservant un créneau à la première
                envie de chaque participant. <strong>Aucun lieu n’est inventé</strong> : c’est
                à vous d’y poser les vraies adresses.
              </p>
              {planPropose && !planPropose.everyoneServed && (
                <p className="text-gold-700 dark:text-gold-300 text-sm">
                  Le séjour est trop court pour servir toutes les envies du groupe.
                </p>
              )}
              <Button block loading={generer.isPending} onClick={() => generer.mutate()}>
                Générer l’itinéraire
              </Button>
            </CardBody>
          </Card>
        </>
      )}

      {aCompleter.length > 0 && (
        <Card className="border-brand-200 dark:border-brand-800 border-dashed">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPinned className="text-brand-500 size-4 shrink-0" aria-hidden />
              <h2 className="text-sm font-bold">Des vrais lieux pour ces créneaux</h2>
            </div>
            <p className="text-muted text-sm leading-relaxed">
              {aCompleter.length} moment{aCompleter.length > 1 ? 's' : ''} du séjour
              {aCompleter.length > 1 ? ' portent' : ' porte'} encore un titre générique.
              Tripora peut y poser des endroits qui existent, relevés sur OpenStreetMap et
              regroupés par quartier pour ne pas traverser la ville quatre fois.
            </p>
            <Button
              block
              variant="secondary"
              loading={completer.isPending}
              onClick={() => completer.mutate(aCompleter)}
            >
              Compléter avec de vrais lieux
            </Button>
            {/* Ce que ça remplace était neutre ; ce que quelqu'un a écrit ne
                bouge pas. Et chaque ligne reste modifiable après coup. */}
            <p className="text-muted text-xs">
              Rien de ce que vous avez écrit ne sera touché, et chaque lieu reste
              modifiable ensuite.
            </p>
          </CardBody>
        </Card>
      )}

      {echanges.length > 0 && (
        <Card className="border-gold-400/50 border-dashed">
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="text-gold-600 dark:text-gold-400 size-4 shrink-0" aria-hidden />
              <h2 className="text-sm font-bold">La météo contrarie le programme</h2>
            </div>
            <ul className="space-y-1.5">
              {echanges.map((echange) => (
                <li key={`${echange.from}-${echange.to}`} className="text-sm leading-relaxed">
                  {echange.reason}
                </li>
              ))}
            </ul>
            {/* Tripora ne déplace rien tout seul : un itinéraire qui se
                réorganiserait pendant la nuit serait impossible à suivre. */}
            <p className="text-muted text-xs">
              À vous de voir — Tripora ne change rien sans vous. Les journées se réorganisent
              en déplaçant les activités avec les flèches.
            </p>
          </CardBody>
        </Card>
      )}

      {enregistre && enregistre.length > 0 && (
        <>
          <nav aria-label="Journées" className="flex gap-2 overflow-x-auto pb-1">
            {enregistre.map((jour) => (
              <button
                key={jour.id}
                type="button"
                onClick={() => setJourActif(jour.dayIndex)}
                aria-current={jourActif === jour.dayIndex ? 'true' : undefined}
                className={cn(
                  'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
                  jourActif === jour.dayIndex
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-[color:var(--border-subtle)] text-muted',
                )}
              >
                Jour {jour.dayIndex}
              </button>
            ))}
          </nav>

          {enregistre
            .filter((jour) => jour.dayIndex === jourActif)
            .map((jour) => (
              <Journee
                key={jour.id}
                jour={jour}
                tripId={id!}
                destination={destination}
                meteo={jour.date ? meteoParJour.get(jour.date) : undefined}
                members={voyage.data?.members ?? []}
                enAjout={ajoutSur === jour.id}
                onOuvrirAjout={() => setAjoutSur(ajoutSur === jour.id ? null : jour.id)}
                onAjouter={(valeurs) =>
                  ajouter.mutate({ dayId: jour.id, voisins: jour.items, ...valeurs })
                }
                ajoutEnCours={ajouter.isPending}
                onSupprimer={(itemId) => supprimer.mutate(itemId)}
                onDeplacer={(item, sens) => deplacer.mutate({ item, sens, liste: jour.items })}
              />
            ))}

          <Button
            variant="ghost"
            block
            icon={<RotateCcw className="size-4" aria-hidden />}
            loading={regenerer.isPending}
            onClick={() => {
              if (window.confirm('Régénérer effacera les ajouts du groupe. Continuer ?')) {
                regenerer.mutate();
              }
            }}
          >
            Régénérer depuis les envies actuelles
          </Button>
        </>
      )}
    </div>
  );
}

function Journee({
  jour,
  tripId,
  destination,
  meteo,
  members,
  enAjout,
  onOuvrirAjout,
  onAjouter,
  ajoutEnCours,
  onSupprimer,
  onDeplacer,
}: {
  jour: ItineraryDayView;
  tripId: string;
  /** Absente tant que le groupe n'a pas tranché : pas de lieux à proposer. */
  destination: Destination | undefined;
  /** La prévision de ce jour-là, si le départ est assez proche. */
  meteo: DailyWeather | undefined;
  members: readonly MemberPreference[];
  enAjout: boolean;
  onOuvrirAjout: () => void;
  onAjouter: (valeurs: {
    title: string;
    startTime: string;
    cost: string;
    notes: string | null;
  }) => void;
  ajoutEnCours: boolean;
  onSupprimer: (itemId: string) => void;
  onDeplacer: (item: ItineraryItem, sens: -1 | 1) => void;
}) {
  const [titre, setTitre] = useState('');
  const [heure, setHeure] = useState('');
  const [cout, setCout] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const total = jour.items.reduce((somme, item) => somme + item.costCents, 0);

  return (
    <section className="animate-rise space-y-3">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">{jour.summary}</h2>
          {jour.date && (
            <p className="text-muted flex flex-wrap items-center gap-x-2 text-sm">
              <span>
                {new Date(`${jour.date}T00:00:00`).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
              {meteo && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                    dayVerdict(meteo) === 'dedans'
                      ? 'bg-gold-500/15 text-gold-700 dark:text-gold-300'
                      : 'bg-[color:var(--surface-muted)]',
                  )}
                >
                  <span aria-hidden>{weatherEmoji(meteo.code)}</span>
                  {describeDay(meteo)}
                  {dayVerdict(meteo) === 'dedans' && ' — plutôt à l’abri'}
                </span>
              )}
            </p>
          )}
        </div>
        <span className="text-muted shrink-0 text-sm tabular-nums">
          {formatCents(total, 'EUR', { hideCentimes: true })}
        </span>
      </header>

      <ul className="space-y-2">
        {jour.items.map((item, index) => (
          <li key={item.id}>
            <Card>
              <CardBody className="flex items-start gap-3 p-3.5">
                <span aria-hidden className="pt-0.5 text-lg">
                  {item.axis ? AXIS_EMOJI[item.axis] : (ICONES[item.kind] ?? '📍')}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    {item.startTime && (
                      <span className="text-muted text-sm tabular-nums">{item.startTime}</span>
                    )}
                    <span className="font-semibold">{item.title}</span>
                    {item.costCents > 0 && (
                      <span className="text-muted text-sm tabular-nums">
                        {formatCents(item.costCents, 'EUR', { hideCentimes: true })}
                      </span>
                    )}
                  </p>
                  {item.reason && (
                    <p className="text-muted mt-0.5 text-xs leading-snug">{item.reason}</p>
                  )}
                  {item.notes && <p className="mt-1 text-sm">{item.notes}</p>}
                </div>

                {/* En ligne plutôt qu'empilés : trois boutons l'un sous l'autre
                    imposaient 230 px de haut par créneau, soit quatre visibles
                    sur un téléphone. */}
                <div className="-mt-0.5 -mr-1 flex shrink-0 gap-0.5">
                  <BoutonIcone
                    label={`Monter ${item.title}`}
                    disabled={index === 0}
                    onClick={() => onDeplacer(item, -1)}
                  >
                    <ChevronUp className="size-4" aria-hidden />
                  </BoutonIcone>
                  <BoutonIcone
                    label={`Descendre ${item.title}`}
                    disabled={index === jour.items.length - 1}
                    onClick={() => onDeplacer(item, 1)}
                  >
                    <ChevronDown className="size-4" aria-hidden />
                  </BoutonIcone>
                  <BoutonIcone label={`Retirer ${item.title}`} onClick={() => onSupprimer(item.id)}>
                    <Trash2 className="size-4" aria-hidden />
                  </BoutonIcone>
                </div>
              </CardBody>
            </Card>
          </li>
        ))}
      </ul>

      {enAjout ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Ajouter au programme</p>
              <BoutonIcone label="Annuler" onClick={onOuvrirAjout}>
                <X className="size-4" aria-hidden />
              </BoutonIcone>
            </div>
            <EpinglesDuGroupe
              tripId={tripId}
              dejaAuProgramme={jour.items.map((item) => item.title)}
              onChoisir={(epingle) => {
                setTitre(epingle.label);
                setNote(epingle.address ?? epingle.url);
              }}
            />

            {destination && (
              <LieuxSuggeres
                destination={destination}
                members={members}
                onChoisir={(lieu: Poi) => {
                  setTitre(lieu.name);
                  setNote(null);
                }}
              />
            )}

            <Field
              label="Quoi ?"
              hint={
                destination
                  ? 'Choisissez ci-dessus, ou écrivez ce que vous voulez.'
                  : 'Le nom du vrai lieu, celui que vous avez trouvé.'
              }
            >
              <TextInput
                value={titre}
                onChange={(event) => setTitre(event.target.value)}
                placeholder="Marché de Sant Antoni"
                aria-label="Nom du lieu ou de l’activité"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="À quelle heure ?">
                <TextInput
                  type="time"
                  value={heure}
                  onChange={(event) => setHeure(event.target.value)}
                />
              </Field>
              <Field label="Combien ?">
                <MoneyInput label="Coût" placeholder="15" value={cout} onChange={setCout} />
              </Field>
            </div>
            <Button
              block
              disabled={titre.trim().length === 0}
              loading={ajoutEnCours}
              onClick={() => {
                onAjouter({ title: titre, startTime: heure, cost: cout, notes: note });
                setTitre('');
                setHeure('');
                setCout('');
                setNote(null);
              }}
            >
              Ajouter
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Button
          variant="secondary"
          block
          icon={<Plus className="size-4" aria-hidden />}
          onClick={onOuvrirAjout}
        >
          Ajouter un lieu à cette journée
        </Button>
      )}
    </section>
  );
}

function BoutonIcone({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'text-muted grid size-9 place-items-center rounded-lg transition-colors',
        'hover:text-brand-500 disabled:opacity-30',
      )}
    >
      {children}
    </button>
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
