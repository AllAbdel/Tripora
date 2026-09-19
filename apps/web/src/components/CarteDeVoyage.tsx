import { Link } from 'react-router';
import { Star, Users } from 'lucide-react';
import { Drapeau } from '@/components/Drapeau';
import { cn } from '@/lib/cn';
import type { TripSummary } from '@/lib/trips';

/**
 * Un voyage, sous la forme d'une étiquette de bagage.
 *
 * C'était une carte blanche arrondie : un titre, une pastille bleue, deux
 * lignes grises. Correct, et interchangeable — la même carte aurait pu lister
 * des factures ou des tickets d'assistance. Or c'est l'objet central de
 * l'application, celui qu'on voit en premier et le plus souvent, et il ne
 * racontait rien.
 *
 * Il raconte maintenant un départ. La face porte la photo de la destination,
 * plein cadre, avec le nom du voyage posé dessus dans la romane — une image
 * fait davantage pour l'envie de partir que n'importe quelle étiquette. Sous
 * elle, un talon séparé par un filet aligne les faits en petites capitales,
 * comme la bande imprimée d'une étiquette d'enregistrement. Et un œillet
 * perforé en haut à gauche, parce que c'est par là qu'on l'attache.
 *
 * Sans photo — en mode local, ou avant que la couverture n'arrive — la face ne
 * devient pas un rectangle vide : le nom du lieu s'y compose en très grand,
 * débordant volontairement du cadre. Une absence assumée vaut mieux qu'un trou
 * qu'on essaie de cacher.
 */

const ETATS: Record<string, string> = {
  draft: 'Brouillon',
  proposing: 'En recherche',
  voting: 'Vote en cours',
  planned: 'Destination choisie',
  ongoing: 'En cours',
  done: 'Terminé',
};

export function CarteDeVoyage({ trip, epingle }: { trip: TripSummary; epingle: boolean }) {
  const etat = ETATS[trip.status] ?? trip.status;

  return (
    /* Le lien est nommé explicitement. Sans cela, son nom accessible agrège
       tout ce que la carte contient — « Destination choisie Bali entre potes
       Bali 4 local » — et un lecteur d'écran récite la fiche entière à chaque
       tabulation. Le titre suffit à savoir où l'on va ; le reste se lit dans
       la carte, qui n'a pas disparu pour autant. */
    <Link to={`/voyages/${trip.id}`} aria-label={trip.title} className="block">
      <article
        className={cn(
          'pressable surface-raised relative overflow-hidden rounded-[var(--radius-card)] border',
          'shadow-[var(--shadow-card)] transition-colors',
          epingle ? 'border-gold-500' : 'filet',
        )}
      >
        <Face trip={trip} epingle={epingle} />

        {/* Le talon. Tout y est en petites capitales et en chasse fixe pour les
            chiffres : c'est une bande de renseignements, pas une phrase. */}
        <div className="flex items-center gap-2.5 border-t px-3.5 py-2.5 filet">
          {trip.destinationName ? (
            <>
              <Drapeau code={trip.destinationCountryCode} />
              <span className="etiquette truncate text-[color:var(--text-strong)]">
                {trip.destinationName}
              </span>
            </>
          ) : (
            <span className="etiquette truncate">{etat}</span>
          )}

          <span className="etiquette chiffres ms-auto inline-flex shrink-0 items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            {trip.participants}
          </span>

          {trip.localOnly && (
            <span className="etiquette shrink-0 border-s ps-2.5 filet">local</span>
          )}
        </div>
      </article>
    </Link>
  );
}

function Face({ trip, epingle }: { trip: TripSummary; epingle: boolean }) {
  const etat = ETATS[trip.status] ?? trip.status;
  const photo = Boolean(trip.coverImageUrl);

  return (
    <div className="relative h-36 overflow-hidden">
      {photo ? (
        <img
          src={trip.coverImageUrl!}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <PlaqueTypographique trip={trip} />
      )}

      {/* Le voile n'existe que sous une photo, où le titre blanc doit tenir
          sur une plage surexposée comme sur une ruelle sombre. Posé sur la
          plaque typographique, il ne protégeait rien et salissait tout : un
          crème vire au gris de cendre dès qu'on l'assombrit. Sans photo, le
          titre passe donc en encre et le papier reste du papier. */}
      {photo && (
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#1a1713]/85 via-[#1a1713]/20 to-transparent"
        />
      )}

      {/* L'œillet : le trou par lequel l'étiquette s'attache à la valise. */}
      <span
        aria-hidden
        className={cn(
          'absolute top-3.5 left-3.5 size-3 rounded-full border-2',
          photo
            ? 'border-[#fffdf8]/70 bg-[#1a1713]/25'
            : 'border-[color:var(--border-fort)] bg-[color:var(--surface-muted)]',
        )}
      />

      {/* Le tampon d'état, posé de travers comme à l'encre. L'étoile de
          l'épingle se range à côté : deux marques dans le même coin valent
          mieux qu'une de chaque côté. */}
      <span className="absolute top-3 right-3 inline-flex items-center gap-1.5">
        {epingle && (
          <Star
            className={cn(
              'size-3.5 shrink-0 fill-current',
              photo ? 'text-gold-300' : 'text-gold-500',
            )}
            aria-label="Épinglé"
          />
        )}
        <span
          className={cn(
            'etiquette -rotate-3 rounded-[3px] border px-1.5 py-0.5 text-[0.625rem]',
            photo
              ? 'border-[#fffdf8]/55 text-[#fffdf8]/90 backdrop-blur-[2px]'
              : 'border-[color:var(--border-fort)] text-[color:var(--text-muted)]',
          )}
        >
          {etat}
        </span>
      </span>

      <h2
        className={cn(
          'titre-lieu absolute inset-x-3.5 bottom-2.5 line-clamp-2 text-[1.6rem]',
          photo ? 'text-[#fffdf8]' : 'text-[color:var(--text-strong)]',
        )}
      >
        {trip.title}
      </h2>
    </div>
  );
}

/**
 * La face sans photo : le nom du lieu, très grand, volontairement coupé.
 *
 * Un cadre vide dit « il manque quelque chose ». Une lettre qui déborde dit
 * « c'est voulu ». La teinte reprend le papier bruni plutôt qu'un gris, pour
 * rester dans la même matière que le reste.
 */
function PlaqueTypographique({ trip }: { trip: TripSummary }) {
  const mot = (trip.destinationName ?? trip.title).trim();
  return (
    <div
      aria-hidden
      className="absolute inset-0 grid place-items-center overflow-hidden
                 bg-[color:var(--color-paper-100)] dark:bg-[color:var(--color-ink-700)]"
    >
      <span
        className="titre-lieu translate-y-[0.06em] scale-110 text-[4.5rem] whitespace-nowrap
                   text-[color:var(--color-paper-300)] dark:text-[color:var(--color-ink-500)]"
      >
        {mot}
      </span>
    </div>
  );
}
