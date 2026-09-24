import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BedDouble,
  Bookmark,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Ticket,
  TrainFront,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import {
  formatCents,
  heureLisible,
  nuitsDe,
  trierLesReservations,
  trouverFournisseur,
  type DonneesDeReservation,
  type Reservation,
  type TypeDeReservation,
} from '@tripora/core';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListeFantome } from '@/components/ui/Squelette';
import { TitreDePage } from '@/components/TitreDePage';
import { FicheDeReservation } from '@/components/FicheDeReservation';
import { BoiteDeConfirmation } from '@/components/ConfirmerSuppression';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { cleVoyage, getTripRepository } from '@/lib/trips';
import { cleReservations, getReservations, requeteDesReservations } from '@/lib/reservations';
import { toFailure } from '@/lib/errors';
import { signaler } from '@/lib/feedback';
import { cn } from '@/lib/cn';

/**
 * Ce qui est réservé : l'hôtel, les visites, les trajets.
 *
 * Tout le groupe voit tout, chacun ajoute ce qu'il a réservé. L'écran se lit
 * comme un programme — du plus proche au plus lointain — avec, pour chaque
 * ligne, ce qu'on cherche vraiment sur place : l'adresse, l'heure, et le
 * numéro à donner à l'accueil.
 */
export default function TripReservations() {
  const { id } = useParams();
  const { identity } = useAuth();
  const queryClient = useQueryClient();
  const [edition, setEdition] = useState<Reservation | 'nouvelle' | null>(null);
  const [aSupprimer, setASupprimer] = useState<Reservation | null>(null);

  const voyage = useQuery({
    queryKey: cleVoyage(id),
    queryFn: () => getTripRepository().get(id!),
    enabled: Boolean(id),
  });
  const reservations = useQuery(requeteDesReservations(id));

  // Une réservation ajoutée par un ami apparaît sans recharger.
  useEffect(() => {
    if (!id) return;
    return getReservations().ecouter(id, () => {
      void queryClient.invalidateQueries({ queryKey: cleReservations(id) });
    });
  }, [id, queryClient]);

  const rafraichir = () => queryClient.invalidateQueries({ queryKey: cleReservations(id) });

  const enregistrer = useMutation({
    mutationFn: async (donnees: DonneesDeReservation) => {
      if (edition && edition !== 'nouvelle') await getReservations().modifier(edition.id, donnees);
      else await getReservations().ajouter(id!, donnees);
    },
    onSuccess: async () => {
      signaler('reussite');
      setEdition(null);
      await rafraichir();
    },
  });

  const supprimer = useMutation({
    mutationFn: (reservation: Reservation) => getReservations().supprimer(reservation.id),
    onSuccess: async () => {
      setASupprimer(null);
      await rafraichir();
    },
  });

  const parJour = useMemo(() => {
    const groupes = new Map<string, Reservation[]>();
    for (const reservation of trierLesReservations(reservations.data ?? [])) {
      const liste = groupes.get(reservation.debutLe) ?? [];
      liste.push(reservation);
      groupes.set(reservation.debutLe, liste);
    }
    return [...groupes];
  }, [reservations.data]);

  const estOrganisateur = Boolean(voyage.data?.isOwner);
  const peutModifier = (reservation: Reservation) =>
    !supabase || estOrganisateur || reservation.creePar === identity?.id;

  const total = useMemo(() => totauxParDevise(reservations.data ?? []), [reservations.data]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-5 pt-6 pb-28">
      <Link
        to={`/voyages/${id ?? ''}`}
        className="text-muted hover:text-brand-500 -ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour au voyage
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TitreDePage pastille="hebergements">Réservations</TitreDePage>
        {edition === null && (reservations.data?.length ?? 0) > 0 && (
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdition('nouvelle')}>
            Ajouter
          </Button>
        )}
      </div>

      {total.length > 0 && (
        <p className="text-muted text-sm">
          {reservations.data!.length} réservation{reservations.data!.length > 1 ? 's' : ''} ·{' '}
          {total.join(' + ')} déjà engagés
        </p>
      )}

      {reservations.error && <Banner tone="warning">{toFailure(reservations.error).message}</Banner>}
      {enregistrer.error && <Banner tone="warning">{toFailure(enregistrer.error).message}</Banner>}

      {edition !== null && (
        <FicheDeReservation
          key={edition === 'nouvelle' ? 'nouvelle' : edition.id}
          {...(edition !== 'nouvelle' ? { initiale: edition } : {})}
          enregistrement={enregistrer.isPending}
          surEnregistrer={(donnees) => enregistrer.mutate(donnees)}
          surAnnuler={() => setEdition(null)}
        />
      )}

      {reservations.isPending && <ListeFantome combien={3} />}

      {reservations.data && reservations.data.length === 0 && edition === null && (
        <EmptyState
          title="Rien de réservé pour l’instant"
          description="Collez l’e-mail de confirmation de Booking, Airbnb, GetYourGuide ou d’ailleurs : l’hôtel, la visite ou le train se range tout seul, à la bonne date, pour tout le groupe."
          action={
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdition('nouvelle')}>
              Ajouter une réservation
            </Button>
          }
        />
      )}

      <div className="space-y-6">
        {parJour.map(([jour, liste]) => (
          <section key={jour} className="space-y-2.5" aria-label={dateLongue(jour)}>
            <h2 className="etiquette-filet">
              <span className="etiquette">{dateLongue(jour)}</span>
            </h2>
            <ul className="space-y-2.5">
              {liste.map((reservation) => (
                <li key={reservation.id}>
                  <CarteDeReservation
                    reservation={reservation}
                    modifiable={peutModifier(reservation)}
                    surModifier={() => setEdition(reservation)}
                    surSupprimer={() => setASupprimer(reservation)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <BoiteDeConfirmation
        ouverte={aSupprimer !== null}
        titre={`Retirer « ${aSupprimer?.titre ?? ''} » ?`}
        message="La réservation elle-même n’est pas annulée chez le site où elle a été faite : seule la fiche disparaît de Tripora, pour tout le groupe."
        action="Retirer"
        enCours={supprimer.isPending}
        surConfirmer={() => aSupprimer && supprimer.mutate(aSupprimer)}
        surAnnuler={() => setASupprimer(null)}
      />
    </div>
  );
}

const ICONES: Record<TypeDeReservation, typeof BedDouble> = {
  hebergement: BedDouble,
  activite: Ticket,
  transport: TrainFront,
  restaurant: UtensilsCrossed,
  autre: Bookmark,
};

function CarteDeReservation({
  reservation,
  modifiable,
  surModifier,
  surSupprimer,
}: {
  reservation: Reservation;
  modifiable: boolean;
  surModifier: () => void;
  surSupprimer: () => void;
}) {
  const [copie, setCopie] = useState(false);
  const Icone = ICONES[reservation.type];
  const fournisseur = trouverFournisseur(reservation.fournisseur);
  const lien = reservation.lien ?? fournisseur?.site ?? null;
  const nuits = reservation.type === 'hebergement' ? nuitsDe(reservation) : null;

  async function copier() {
    if (!reservation.reference) return;
    try {
      await navigator.clipboard.writeText(reservation.reference);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé : la référence reste affichée, et sélectionnable.
    }
  }

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="bg-brand-500/10 text-brand-700 dark:text-brand-200 grid size-10 shrink-0 place-items-center rounded-xl">
            <Icone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-snug">{reservation.titre}</h3>
            <p className="text-muted text-sm">
              {[fournisseur?.nom, horaires(reservation), nuits ? `${nuits} nuit${nuits > 1 ? 's' : ''}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          {reservation.prixCents !== null && reservation.prixCents !== undefined && (
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              {formatCents(reservation.prixCents, reservation.devise, { hideCentimes: true })}
            </p>
          )}
        </div>

        {reservation.adresse && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              reservation.lat !== null && reservation.lat !== undefined && reservation.lng !== null && reservation.lng !== undefined
                ? `${reservation.lat},${reservation.lng}`
                : reservation.adresse,
            )}`}
            target="_blank"
            rel="noreferrer"
            className="text-muted hover:text-brand-600 flex items-start gap-2 text-sm"
          >
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{reservation.adresse}</span>
          </a>
        )}

        {reservation.notes && <p className="text-sm leading-relaxed">{reservation.notes}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {reservation.reference && (
            <button
              type="button"
              onClick={() => void copier()}
              className="surface-raised inline-flex min-h-9 items-center gap-2 rounded-full border border-[color:var(--border-subtle)] px-3 text-sm"
              aria-label={`Copier la référence ${reservation.reference}`}
            >
              <span className="font-mono tracking-wide">{reservation.reference}</span>
              {copie ? (
                <Check className="size-4 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="text-muted size-4" aria-hidden />
              )}
            </button>
          )}
          {lien && (
            <a
              href={lien}
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 dark:text-brand-200 hover:bg-brand-500/10 inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
            >
              {reservation.lien ? 'Gérer la réservation' : `Ouvrir ${fournisseur?.nom ?? 'le site'}`}
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {modifiable && (
            <div className={cn('ml-auto flex gap-1')}>
              <button
                type="button"
                onClick={surModifier}
                className="text-muted hover:text-brand-600 grid size-9 place-items-center rounded-full"
                aria-label={`Modifier ${reservation.titre}`}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={surSupprimer}
                className="text-muted grid size-9 place-items-center rounded-full hover:text-red-600"
                aria-label={`Retirer ${reservation.titre}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function dateLongue(date: string): string {
  const jour = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(jour.getTime())) return date;
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(jour);
}

function dateCourte(date: string): string {
  const jour = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(jour.getTime())) return date;
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(jour);
}

/** « arrivée 14:00 → départ jeu. 16 juil. 12:00 », « 02:00 ». */
function horaires(reservation: Reservation): string | null {
  const debut = heureLisible(reservation.debutA);
  if (reservation.type === 'hebergement') {
    const arrivee = debut ? `arrivée ${debut}` : null;
    const depart = reservation.finLe
      ? `départ ${dateCourte(reservation.finLe)}${reservation.finA ? ` ${heureLisible(reservation.finA)}` : ''}`
      : null;
    return [arrivee, depart].filter(Boolean).join(' → ') || null;
  }
  const fin =
    reservation.finLe && reservation.finLe !== reservation.debutLe
      ? `jusqu’au ${dateCourte(reservation.finLe)}`
      : reservation.finA
        ? `jusqu’à ${heureLisible(reservation.finA)}`
        : null;
  return [debut, fin].filter(Boolean).join(' ') || null;
}

/** « 612 € + 3 500 000 IDR » : on n'additionne pas des devises différentes. */
function totauxParDevise(reservations: readonly Reservation[]): string[] {
  const sommes = new Map<string, number>();
  for (const reservation of reservations) {
    if (!reservation.prixCents) continue;
    sommes.set(reservation.devise, (sommes.get(reservation.devise) ?? 0) + reservation.prixCents);
  }
  return [...sommes].map(([devise, cents]) => formatCents(cents, devise, { hideCentimes: true }));
}
