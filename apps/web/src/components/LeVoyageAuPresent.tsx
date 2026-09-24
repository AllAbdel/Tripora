import { Link } from 'react-router';
import { PropositionDeRappels } from '@/components/ReglageDesRappels';
import { rappelsPossibles } from '@/lib/rappels';
import { BedDouble, CalendarClock, Check, HandCoins, KeyRound, PartyPopper, Plus, Sun } from 'lucide-react';
import {
  dateDuJour,
  heureLisible,
  momentDuVoyage,
  nuitsSansHebergement,
  periodeLisible,
  phraseDeReservation,
  reservationsDuJour,
  type Reservation,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import type { ItineraryDayView } from '@/lib/itinerary';
import { cn } from '@/lib/cn';

/**
 * Le voyage au présent : ce qui compte aujourd'hui, en haut de son accueil.
 *
 * Avant le départ, le compte à rebours et ce qui manque encore — une nuit
 * sans toit se découvre mieux trois semaines avant qu'à 22 h sur un parking.
 * Pendant, le jour du séjour, ce qui est réservé et prévu aujourd'hui, et la
 * dépense qu'on vient de faire. Après, les comptes à solder.
 *
 * Rien ne s'affiche tant que les dates ne sont pas arrêtées : « en juillet »
 * n'a pas de compte à rebours honnête.
 */

/** Au-delà, le retour n'appelle plus rien : les comptes sont faits ou oubliés. */
const JOURS_APRES = 30;

const LIEN =
  'bg-[color:var(--surface-muted)] hover:bg-brand-50 dark:hover:bg-ink-700/40 inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors';

export function LeVoyageAuPresent({
  tripId,
  debut,
  fin,
  fuseau,
  reservations,
  itineraire,
  infosDuCoffre,
  maintenant,
}: {
  tripId: string;
  /** Dates exactes du séjour, ou `null` quand elles ne sont pas arrêtées. */
  debut: string | null;
  fin: string | null;
  /** Le fuseau de la destination : le jour qu'il est là-bas. */
  fuseau?: string | undefined;
  reservations: readonly Reservation[] | undefined;
  itineraire: readonly ItineraryDayView[] | undefined;
  /** Combien d'infos dans le coffre ; `undefined` tant qu'on ne sait pas. */
  infosDuCoffre?: number | undefined;
  /** Pour les tests : l'instant présent. */
  maintenant?: Date;
}) {
  const aujourdhui = dateDuJour(fuseau, maintenant);
  const moment = momentDuVoyage(debut, fin, aujourdhui);
  if (!moment || !debut || !fin) return null;
  if (moment.phase === 'apres' && moment.depuisJours > JOURS_APRES) return null;

  const trous = nuitsSansHebergement(debut, fin, reservations ?? []);

  if (moment.phase === 'avant') {
    const nuits = trous.reduce((total, trou) => total + trou.nuits, 0);
    return (
      <Cadre
        icone={CalendarClock}
        titre={moment.dansJours === 1 ? 'Départ demain' : `Départ dans ${moment.dansJours} jours`}
        detail={periodeLisible(debut, fin)}
      >
        {/* Sans réservations chargées, on ne sait pas : mieux vaut se taire
            que d'annoncer à tort des nuits dehors. */}
        {reservations && fin > debut && (
          <ul className="space-y-2 text-sm">
            {nuits === 0 ? (
              <Ligne ton="ok">Chaque nuit a son hébergement réservé.</Ligne>
            ) : (
              trous.map((trou) => (
                <Ligne key={trou.arrivee} ton="alerte">
                  {trou.nuits === 1 ? 'Une nuit' : `${trou.nuits} nuits`} sans hébergement réservé,{' '}
                  {periodeLisible(trou.arrivee, trou.depart)}.
                </Ligne>
              ))
            )}
          </ul>
        )}
        {/* Les derniers jours : le code de la boîte à clés arrive par
            message, c'est le moment de le ranger là où on le retrouvera. */}
        {moment.dansJours <= 3 && infosDuCoffre === 0 && (
          <p className="text-muted text-sm">
            Le code d’accès, le wifi, le numéro de l’hôte ?{' '}
            <Link to={`/voyages/${tripId}/coffre`} className="text-brand-600 dark:text-brand-300 font-medium underline">
              Rangez-les dans le coffre
            </Link>{' '}
            pour les retrouver sans réseau.
          </p>
        )}
        {reservations && nuits > 0 && (
          <Link to={`/voyages/${tripId}/reservations`} className={LIEN}>
            <Plus className="size-4" aria-hidden />
            Ajouter un hébergement
          </Link>
        )}
        {rappelsPossibles && <PropositionDeRappels />}
      </Cadre>
    );
  }

  if (moment.phase === 'pendant') {
    const duJour = reservationsDuJour(reservations ?? [], aujourdhui);
    const journee = itineraire?.find((jour) => jour.date === aujourdhui || jour.dayIndex === moment.jour);
    // Ce qu'on fait, pas les allers-retours à l'hôtel : ceux-là sont déjà dans
    // les réservations du jour, juste au-dessus.
    const activites = (journee?.items ?? [])
      .filter((item) => ['activity', 'meal', 'evening'].includes(item.kind) && item.title.trim() !== '')
      .slice(0, 4);
    // Le dernier jour, on repart : pas de nuit à chercher.
    const sansToitCeSoir = aujourdhui < fin && trous.some((trou) => trou.arrivee <= aujourdhui && aujourdhui < trou.depart);

    return (
      <Cadre
        icone={Sun}
        titre={`Jour ${moment.jour} sur ${moment.sur}`}
        detail={moment.jour === moment.sur ? 'Dernier jour du séjour' : 'Aujourd’hui'}
        vif
      >
        {(duJour.length > 0 || activites.length > 0 || sansToitCeSoir) && (
          <ul className="space-y-2 text-sm">
            {duJour.map((instant) => (
              <Ligne key={`${instant.quoi}-${instant.reservation.id}`} icone={BedDouble}>
                {phraseDeReservation(instant)}
              </Ligne>
            ))}
            {activites.map((item) => (
              <Ligne key={item.id}>
                {[heureLisible(item.startTime), item.title].filter(Boolean).join(' · ')}
              </Ligne>
            ))}
            {sansToitCeSoir && (
              <Ligne ton="alerte">
                Aucun hébergement réservé pour ce soir.{' '}
                <Link
                  to={`/voyages/${tripId}/reservations`}
                  className="text-brand-600 dark:text-brand-300 font-medium underline"
                >
                  L’ajouter
                </Link>
              </Ligne>
            )}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <Link to={`/voyages/${tripId}/itineraire?jour=${moment.jour}`} className={LIEN}>
            Programme du jour
          </Link>
          <Link to={`/voyages/${tripId}/budget?ajouter=1`} className={LIEN}>
            <Plus className="size-4" aria-hidden />
            Une dépense
          </Link>
          {Boolean(infosDuCoffre) && (
            <Link to={`/voyages/${tripId}/coffre`} className={LIEN}>
              <KeyRound className="size-4" aria-hidden />
              Codes et wifi
            </Link>
          )}
        </div>
      </Cadre>
    );
  }

  return (
    <Cadre
      icone={HandCoins}
      titre={moment.depuisJours === 1 ? 'De retour depuis hier' : `De retour depuis ${moment.depuisJours} jours`}
      detail="Il reste peut-être des comptes à solder."
    >
      <div className="flex flex-wrap gap-2">
        <Link to={`/voyages/${tripId}/bilan`} className={LIEN}>
          <PartyPopper className="size-4" aria-hidden />
          Le bilan du voyage
        </Link>
        <Link to={`/voyages/${tripId}/budget`} className={LIEN}>
          Qui doit quoi
        </Link>
      </div>
    </Cadre>
  );
}

function Cadre({
  icone: Icone,
  titre,
  detail,
  vif = false,
  children,
}: {
  icone: typeof Sun;
  titre: string;
  detail: string;
  vif?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('animate-rise', vif && 'border-brand-500 shadow-[var(--shadow-float)]')}>
      <CardBody className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-xl',
              vif ? 'bg-brand-500 text-[color:var(--accent-contrast)]' : 'text-muted bg-[color:var(--surface-muted)]',
            )}
          >
            <Icone className="size-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">{titre}</h2>
            <p className="text-muted mt-0.5 text-sm">{detail}</p>
          </div>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

function Ligne({
  ton = 'neutre',
  icone: Icone,
  children,
}: {
  /** `alerte` : ce qui manque. `ok` : ce qui est fait. */
  ton?: 'ok' | 'alerte' | 'neutre';
  icone?: typeof Sun;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      {ton === 'ok' ? (
        <Check className="text-brand-600 dark:text-brand-300 mt-0.5 size-4 shrink-0" aria-hidden />
      ) : Icone ? (
        <Icone className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <span
          aria-hidden
          className={cn(
            'mt-2 size-1.5 shrink-0 rounded-full',
            ton === 'alerte' ? 'bg-gold-500' : 'bg-[color:var(--text-muted)]',
          )}
        />
      )}
      <span className="min-w-0">{children}</span>
    </li>
  );
}
