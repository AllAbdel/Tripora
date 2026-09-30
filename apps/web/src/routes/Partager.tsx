import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Link2, MapPin, Search } from 'lucide-react';
import { dateDuJour, findDestination } from '@tripora/core';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { TitreDePage } from '@/components/TitreDePage';
import { getDiscussion } from '@/lib/discussion';
import { getTripRepository, type TripSummary } from '@/lib/trips';
import {
  ceQuiEstPartage,
  LIBELLES_DES_SOURCES,
  lireLePartage,
  messageDeLecture,
  type LectureDuPartage,
} from '@/lib/partage';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * « Partager vers Tripora » : des lieux trouvés dans un lien, épinglés pour le groupe.
 *
 * On arrive ici par le menu Partager du téléphone (TikTok, Instagram,
 * Google Maps, le navigateur…), ou depuis la discussion d'un voyage. Tripora
 * lit le lien, propose les lieux qu'il y trouve, et la personne coche ceux
 * qu'elle veut garder : rien n'est ajouté sans elle.
 */
export default function Partager() {
  const [parametres] = useSearchParams();
  const partage = useMemo(() => ceQuiEstPartage(parametres), [parametres]);
  const discussion = getDiscussion();
  const repository = getTripRepository();
  const queryClient = useQueryClient();

  const [saisie, setSaisie] = useState(() => partage.lien ?? partage.texte);
  const [tripChoisi, setTripChoisi] = useState<string | null>(parametres.get('voyage'));
  const [lecture, setLecture] = useState<LectureDuPartage | null>(null);
  const [coches, setCoches] = useState<ReadonlySet<number>>(new Set());
  const [ajoutes, setAjoutes] = useState<number | null>(null);

  const trips = useQuery({
    queryKey: ['trips', repository.kind],
    queryFn: () => repository.list(),
  });
  const voyages = useMemo(() => ordonner(trips.data ?? []), [trips.data]);
  const tripId = tripChoisi ?? voyages[0]?.id ?? null;
  const voyage = voyages.find((trip) => trip.id === tripId) ?? null;
  const destination = voyage?.destinationId ? findDestination(voyage.destinationId) : undefined;

  const lire = useMutation({
    mutationFn: () => {
      const texte = saisie.trim();
      const lien = ceQuiEstPartage(new URLSearchParams({ texte })).lien;
      return lireLePartage({
        lien,
        texte: texte === lien ? partage.texte : texte,
        pres: destination ? { lat: destination.lat, lng: destination.lng } : null,
        destination: destination?.name ?? null,
      });
    },
    onSuccess: (resultat) => {
      setLecture(resultat);
      setAjoutes(null);
      // Tout ce qui est situé est coché d'office ; le reste attend un geste.
      setCoches(
        new Set(resultat.lieux.flatMap((lieu, index) => (lieu.lat !== null ? [index] : []))),
      );
    },
  });

  // Arrivé par le menu Partager avec un voyage connu : on lit tout de suite.
  const dejaLu = useRef(false);
  useEffect(() => {
    if (dejaLu.current || !saisie.trim() || !tripId || trips.isLoading) return;
    if (!partage.lien && !partage.texte) return;
    dejaLu.current = true;
    lire.mutate();
  }, [saisie, tripId, trips.isLoading, partage, lire]);

  const ajouter = useMutation({
    mutationFn: async () => {
      if (!discussion || !tripId || !lecture) return 0;
      const source = LIBELLES_DES_SOURCES[lecture.source];
      const note = lecture.titre
        ? `Trouvé sur ${source} : « ${lecture.titre.slice(0, 200)} »`
        : `Trouvé sur ${source}`;
      const choisis = lecture.lieux.filter((_, index) => coches.has(index));
      // Aucun lieu trouvé : on épingle au moins le lien, pour ne pas le perdre.
      const aPoser =
        choisis.length > 0
          ? choisis
          : [{ nom: lecture.titre?.slice(0, 120) || 'Lien partagé', lat: null, lng: null, adresse: null }];
      for (const lieu of aPoser) {
        await discussion.addPin(tripId, {
          label: lieu.nom,
          address: lieu.adresse,
          lat: lieu.lat,
          lng: lieu.lng,
          url: lecture.lien,
          note,
        });
      }
      return aPoser.length;
    },
    onSuccess: (nombre) => {
      signaler('reussite');
      setAjoutes(nombre);
      void queryClient.invalidateQueries({ queryKey: ['epingles', tripId] });
    },
    onError: () => signaler('echec'),
  });

  if (!discussion) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <TitreDePage pastille="carte">Des lieux depuis un lien</TitreDePage>
        <Banner tone="warning" title="Mode local">
          Les épingles se partagent avec le groupe : elles demandent un serveur, que cette
          version de Tripora n’a pas.
        </Banner>
      </div>
    );
  }

  const nombreCoches = coches.size;

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-5 pt-6 pb-32">
      <Link
        to={tripId ? `/voyages/${tripId}/discussion` : '/voyages'}
        className="text-muted hover:text-brand-500 -ms-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {tripId ? 'Retour à la discussion' : 'Mes trips'}
      </Link>

      <div className="space-y-1.5">
        <TitreDePage pastille="carte">Des lieux depuis un lien</TitreDePage>
        <p className="text-muted text-sm leading-relaxed">
          Une vidéo TikTok, un Reel, une fiche Google Maps, un article : Tripora y trouve les
          lieux cités et les propose au groupe comme épingles. Vous choisissez ce qui reste.
        </p>
      </div>

      {voyages.length === 0 && !trips.isLoading ? (
        <Banner tone="info" title="Pas encore de voyage">
          Les épingles se posent sur un voyage. <Link to="/voyages/nouveau">Créez-en un</Link>, puis
          partagez à nouveau le lien.
        </Banner>
      ) : (
        voyages.length > 1 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Pour quel voyage ?</legend>
            <div className="flex flex-wrap gap-2">
              {voyages.slice(0, 6).map((trip) => (
                <Chip
                  key={trip.id}
                  selected={trip.id === tripId}
                  onClick={() => {
                    setTripChoisi(trip.id);
                    setLecture(null);
                  }}
                >
                  {trip.title}
                </Chip>
              ))}
            </div>
          </fieldset>
        )
      )}

      <form
        className="space-y-3"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          lire.mutate();
        }}
      >
        <Field
          label="Lien ou texte partagé"
          hint={
            destination
              ? `Les lieux sont cherchés autour de ${destination.name}.`
              : 'Sans destination retenue, les lieux sont cherchés partout : vérifiez-les.'
          }
        >
          <textarea
            value={saisie}
            onChange={(evenement) => setSaisie(evenement.target.value)}
            rows={3}
            maxLength={3000}
            spellCheck={false}
            placeholder="https://www.tiktok.com/@…/video/…"
            className="surface-raised w-full rounded-2xl border border-[color:var(--border-subtle)] px-4 py-3 text-[16px] outline-none focus:border-brand-500"
          />
        </Field>
        <Button
          type="submit"
          block
          size="lg"
          variant={lecture ? 'secondary' : 'primary'}
          loading={lire.isPending}
          disabled={!saisie.trim() || !tripId}
          icon={<Search className="size-5" aria-hidden />}
        >
          {lire.isPending ? 'Lecture du lien…' : 'Trouver les lieux'}
        </Button>
      </form>

      {lire.isError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {messageDeLecture(lire.error)}
        </p>
      )}

      {lecture && (
        <Card className="animate-rise">
          <CardBody className="space-y-4">
            <div className="space-y-1">
              <p className="etiquette">Trouvé sur {LIBELLES_DES_SOURCES[lecture.source]}</p>
              {lecture.titre && (
                <p className="text-muted line-clamp-3 text-sm break-words">« {lecture.titre} »</p>
              )}
            </div>

            {lecture.lieux.length > 0 ? (
              <ul className="space-y-2">
                {lecture.lieux.map((lieu, index) => {
                  const coche = coches.has(index);
                  return (
                    <li key={`${lieu.nom}-${index}`}>
                      <label
                        className={cn(
                          'flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5',
                          coche ? 'border-brand-500' : 'border-[color:var(--border-subtle)]',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={coche}
                          onChange={() => {
                            const suivant = new Set(coches);
                            if (coche) suivant.delete(index);
                            else suivant.add(index);
                            setCoches(suivant);
                          }}
                          className="accent-brand-500 mt-1 size-4"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium break-words">{lieu.nom}</span>
                          <span className="text-muted block text-xs">
                            {lieu.lat !== null
                              ? (lieu.adresse ?? 'Situé sur la carte')
                              : 'Pas situé : l’épingle restera dans la liste, sans point sur la carte'}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted text-sm leading-relaxed">
                {lecture.sansIA
                  ? 'Aucun lieu évident dans ce lien. Vous pouvez l’épingler tel quel, et le situer plus tard.'
                  : 'Aucun lieu précis n’est cité. Vous pouvez épingler le lien tel quel, et le situer plus tard.'}
              </p>
            )}

            {lecture.nonSitues.length > 0 && (
              <p className="text-muted text-xs leading-relaxed">
                Cités, mais introuvables près de la destination : {lecture.nonSitues.join(', ')}.
              </p>
            )}

            {ajoutes !== null ? (
              <div role="status" className="space-y-3">
                <p className="text-lagoon-700 dark:text-lagoon-300 flex items-center gap-2 text-sm font-medium">
                  <Check className="size-4" aria-hidden />
                  {ajoutes > 1 ? `${ajoutes} épingles ajoutées` : 'Épingle ajoutée'} pour tout le groupe.
                </p>
                <Link
                  to={`/voyages/${tripId}/carte`}
                  className="text-brand-700 dark:text-brand-200 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"
                >
                  <MapPin className="size-4" aria-hidden />
                  Voir sur la carte du voyage
                </Link>
              </div>
            ) : (
              <Button
                block
                loading={ajouter.isPending}
                onClick={() => ajouter.mutate()}
                icon={
                  nombreCoches > 0 ? (
                    <MapPin className="size-5" aria-hidden />
                  ) : (
                    <Link2 className="size-5" aria-hidden />
                  )
                }
              >
                {nombreCoches > 1
                  ? `Épingler ${nombreCoches} lieux`
                  : nombreCoches === 1
                    ? 'Épingler ce lieu'
                    : 'Épingler le lien seul'}
                {voyage ? ` · ${voyage.title}` : ''}
              </Button>
            )}
            {ajouter.isError && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                Les épingles n’ont pas pu être ajoutées. Réessayez dans un instant.
              </p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/**
 * Le voyage le plus probable d'abord : celui qui arrive, puis les plus
 * récents. On partage une vidéo de Lisbonne pour le voyage à Lisbonne de
 * juin, pas pour celui de l'an dernier.
 */
function ordonner(trips: readonly TripSummary[]): TripSummary[] {
  const aujourdHui = dateDuJour();
  const aVenir = trips
    .filter((trip) => !trip.endDate || trip.endDate >= aujourdHui)
    .sort((a, b) => (a.startDate ?? '9999').localeCompare(b.startDate ?? '9999'));
  const passes = trips.filter((trip) => trip.endDate && trip.endDate < aujourdHui);
  return [...aVenir, ...passes];
}
