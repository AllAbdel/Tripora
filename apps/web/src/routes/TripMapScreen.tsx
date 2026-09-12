import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, MapPin, Pin, Plane, Star } from 'lucide-react';
import {
  estimateTransportOptions,
  findDestination,
  formatCents,
  haversineKm,
  TRANSPORT_LABELS_FR,
} from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { TripMap, type MapMarker } from '@/components/TripMap';
import { buildTripMarkers } from '@/lib/mapMarkers';
import { chargerLieux } from '@/lib/places';
import { getTripRepository } from '@/lib/trips';
import { getDiscussion } from '@/lib/discussion';
import { useGroupRealtime } from '@/lib/useGroupRealtime';
import { useProposals } from '@/lib/useProposals';
import { toFailure } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Drapeau } from '@/components/Drapeau';

/**
 * La géographie du voyage : d'où l'on part, où l'on pourrait aller, et à quelle
 * distance. Une liste de villes ne dit rien de la carte ; voir Budapest et
 * Lisbonne côte à côte, avec le point de départ, change la conversation.
 */
export default function TripMapScreen() {
  const { id } = useParams<{ id: string }>();
  const repository = getTripRepository();
  const discussion = getDiscussion();
  const [selection, setSelection] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', repository.kind, id],
    queryFn: () => repository.get(id!),
    enabled: Boolean(id),
  });
  useGroupRealtime(id);

  const { proposals } = useProposals(data);

  const retenue = data?.lockedDestinationId ?? null;
  const villeRetenue = retenue ? findDestination(retenue) : undefined;

  // Les lieux ne sont demandés qu'une fois la destination arrêtée : avant, ils
  // n'auraient aucun sens, et ce serait un appel par ville comparée.
  const lieux = useQuery({
    queryKey: ['lieux', villeRetenue?.id],
    queryFn: () => chargerLieux(villeRetenue!),
    enabled: Boolean(villeRetenue),
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Les épingles viennent de la discussion, qui commence avant que la
  // destination soit tranchée : elles s'affichent donc dès le premier jour.
  const epingles = useQuery({
    queryKey: ['epingles', id],
    queryFn: () => discussion!.listPins(id!),
    enabled: Boolean(id && discussion),
  });

  const markers = useMemo<MapMarker[]>(() => {
    if (!data || !proposals) return [];
    return buildTripMarkers({
      origin: data.constraints.origin,
      scores: proposals.scores,
      lockedDestinationId: retenue,
      places: lieux.data?.liste ?? [],
      pins: epingles.data ?? [],
      onSelect: setSelection,
    });
  }, [data, proposals, retenue, lieux.data, epingles.data]);

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
            ? `Vous partez à ${findDestination(retenue)?.name}, à ${Math.round(
                haversineKm(data.constraints.origin, findDestination(retenue)!),
              ).toLocaleString('fr-FR')} km de ${data.constraints.origin.name}`
            : `${proposals?.scores.length ?? 0} destination${
                (proposals?.scores.length ?? 0) > 1 ? 's' : ''
              } en lice au départ de ${data.constraints.origin.name}`}
        </p>
      </div>

      <div className="relative mx-5 min-h-80 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border-subtle)]">
        <TripMap markers={markers} route={trajet} className="absolute inset-0" />
      </div>

      <Legende
        candidates={(proposals?.scores.length ?? 0) - (retenue ? 1 : 0)}
        retenue={Boolean(retenue)}
        lieux={lieux.data?.liste.length ?? 0}
        epingles={epingles.data?.length ?? 0}
      />

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

      <section className="space-y-2 px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold">
          {retenue ? 'Ce que vous verrez sur place' : 'Ce qui est posé sur la carte'}
        </h2>

        {/* Les repères sont des boutons, mais chercher un point de huit pixels
            n'est pas une façon de naviguer — et au lecteur d'écran, ce n'est
            pas une façon du tout. La même carte, en liste. */}
        <ul className="space-y-1.5">
          <li>
            <Rangee
              icone={<Plane className="size-4" aria-hidden />}
              titre={data.constraints.origin.name}
              detail="Point de départ"
            />
          </li>

          {retenue && (proposals?.scores.length ?? 0) === 0 && villeRetenue && (
            <li>
              <Rangee
                icone={<Drapeau code={villeRetenue.countryCode} />}
                titre={villeRetenue.name}
                detail={`${Math.round(
                  haversineKm(data.constraints.origin, villeRetenue),
                ).toLocaleString('fr-FR')} km · ${villeRetenue.country}`}
                marque={<Star className="text-lagoon-500 size-4 fill-current" aria-label="Retenue" />}
              />
            </li>
          )}

          {(proposals?.scores ?? []).map((score) => {
            const ville = findDestination(score.destinationId);
            if (!ville) return null;
            const km = Math.round(haversineKm(data.constraints.origin, ville));
            const rapide = estimateTransportOptions(data.constraints.origin, ville, 1)
              .slice()
              .sort((a, b) => a.durationMin - b.durationMin)[0];
            return (
              <li key={score.destinationId}>
                <Rangee
                  icone={<Drapeau code={ville.countryCode} />}
                  titre={ville.name}
                  detail={`${km.toLocaleString('fr-FR')} km${
                    rapide
                      ? ` · ${TRANSPORT_LABELS_FR[rapide.mode].toLowerCase()} ${heures(
                          rapide.durationMin / 2,
                        )}`
                      : ''
                  }`}
                  marque={
                    retenue === score.destinationId ? (
                      <Star className="text-lagoon-500 size-4 fill-current" aria-label="Retenue" />
                    ) : undefined
                  }
                  actif={selection === score.destinationId}
                  au={() => setSelection(score.destinationId)}
                />
              </li>
            );
          })}

          {(epingles.data ?? []).map((epingle) => (
            <li key={epingle.id}>
              <Rangee
                icone={<Pin className="text-gold-500 size-4" aria-hidden />}
                titre={epingle.label}
                detail="Épinglé dans la discussion"
              />
            </li>
          ))}
        </ul>

        {retenue && (lieux.data?.liste.length ?? 0) > 0 && (
          <p className="text-muted pt-1 text-xs">
            {lieux.data!.liste.length} lieu
            {lieux.data!.liste.length > 1 ? 'x' : ''} de {findDestination(retenue)?.name} sont
            posés sur la carte, en petits points dorés. Touchez-les pour les ouvrir.
          </p>
        )}
      </section>
    </div>
  );
}

/** Une ligne de la liste, cliquable quand elle désigne un repère de la carte. */
function Rangee({
  icone,
  titre,
  detail,
  marque,
  actif = false,
  au,
}: {
  icone: React.ReactNode;
  titre: string;
  detail: string;
  marque?: React.ReactNode;
  actif?: boolean;
  au?: () => void;
}) {
  const contenu = (
    <>
      <span className="grid size-6 shrink-0 place-items-center" aria-hidden>
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{titre}</span>
        <span className="text-muted block truncate text-xs">{detail}</span>
      </span>
      {marque}
    </>
  );

  const classe = cn(
    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors',
    actif
      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40'
      : 'border-[color:var(--border-subtle)]',
  );

  return au ? (
    <button type="button" onClick={au} className={cn(classe, 'min-h-11')}>
      {contenu}
    </button>
  ) : (
    <div className={classe}>{contenu}</div>
  );
}

/**
 * Ce que veulent dire les repères.
 *
 * Sans elle, un chiffre dans un rond bleu et un point doré sont deux mystères.
 * Elle ne s'affiche que pour ce qui est réellement posé sur la carte : une
 * légende qui décrit des symboles absents apprend le contraire de ce qu'on
 * regarde.
 */
function Legende({
  candidates,
  retenue,
  lieux,
  epingles,
}: {
  candidates: number;
  retenue: boolean;
  lieux: number;
  epingles: number;
}) {
  const entrees: { classe: string; texte: string }[] = [
    { classe: 'bg-ink-700', texte: 'Départ' },
    ...(candidates > 0
      ? [{ classe: 'bg-brand-500', texte: `${candidates} en lice, numérotées par rang` }]
      : []),
    ...(retenue ? [{ classe: 'bg-lagoon-500', texte: 'Destination retenue' }] : []),
    ...(lieux > 0 ? [{ classe: 'bg-gold-500', texte: `${lieux} lieux à voir` }] : []),
    ...(epingles > 0 ? [{ classe: 'bg-gold-500', texte: `${epingles} épinglés du groupe` }] : []),
  ];

  return (
    <ul className="text-muted flex flex-wrap gap-x-4 gap-y-1.5 px-5 pt-3 text-xs">
      {entrees.map((entree) => (
        <li key={entree.texte} className="flex items-center gap-1.5">
          <span
            className={cn('size-2.5 rounded-full border border-white', entree.classe)}
            aria-hidden
          />
          {entree.texte}
        </li>
      ))}
    </ul>
  );
}

/** « 2 h 15 », à partir de minutes. */
function heures(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const reste = total % 60;
  if (h === 0) return `${reste} min`;
  return reste === 0 ? `${h} h` : `${h} h ${String(reste).padStart(2, '0')}`;
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
