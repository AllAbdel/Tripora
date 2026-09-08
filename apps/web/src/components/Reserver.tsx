import { ExternalLink } from 'lucide-react';
import {
  sejourDe,
  affilierLiens,
  stayLinks,
  travelLinks,
  type BookingLink,
  type Destination,
  type TripConstraints,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { env } from '@/lib/env';

/**
 * Les liens de réservation, préremplis.
 *
 * Tripora ne réserve rien : aucune plateforme n'ouvre son API de réservation à
 * un projet personnel gratuit, et l'API de prix d'hôtels qui existait a été
 * retirée. Ce bloc fait la seule chose honnête qui reste — éviter de ressaisir
 * six fois la ville, les dates et le nombre de personnes.
 *
 * Il ne s'affiche qu'une fois la destination arrêtée : avant, ce serait pousser
 * à réserver un voyage sur lequel le groupe n'est pas d'accord.
 */
export function Reserver({
  constraints,
  destination,
}: {
  constraints: TripConstraints;
  destination: Destination;
}) {
  const sejour = sejourDe(constraints);
  const dormir = affilierLiens(stayLinks(destination, sejour), env.travelpayoutsMarker);
  const aller = affilierLiens(
    travelLinks(constraints.origin, destination, sejour),
    env.travelpayoutsMarker,
  );
  const commissionne = [...dormir, ...aller].some((lien) => lien.affilie);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="font-bold">Réserver</h2>
          <p className="text-muted text-sm">
            {sejour.checkIn
              ? `Recherches préremplies pour ${sejour.guests} personnes, du ${jour(sejour.checkIn)} au ${jour(sejour.checkOut)}.`
              : `Recherches préremplies pour ${sejour.guests} personnes. Fixez vos dates pour qu’elles le soient aussi.`}
          </p>
        </div>

        <Groupe titre="Où dormir" liens={dormir} />
        <Groupe titre="Comment y aller" liens={aller} />

        {/* La phrase change avec la réalité. Affirmer « on ne touche rien »
            alors qu'un lien est affilié serait le genre de détail qui, une fois
            découvert, fait douter de tout le reste de l'écran. */}
        <p className="text-muted text-xs leading-relaxed">
          Tripora ne réserve rien : les prix affichés là-bas font foi, pas les nôtres.{' '}
          {commissionne
            ? 'Les liens marqués « lien partenaire » peuvent nous rapporter une commission si vous réservez — sans rien changer à votre prix, ni à l’ordre de cette liste.'
            : 'Et ne touche rien sur ces liens.'}
        </p>
      </CardBody>
    </Card>
  );
}

function Groupe({ titre, liens }: { titre: string; liens: BookingLink[] }) {
  if (liens.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold">{titre}</h3>
      <ul className="space-y-1.5">
        {liens.map((lien) => (
          <li key={lien.id}>
            <a
              href={lien.url}
              target="_blank"
              // noopener : la page ouverte ne doit pas pouvoir manipuler la nôtre.
              // sponsored : la même transparence que la mention affichée, côté
              // machine, sur un lien qui peut rapporter.
              rel={lien.affilie ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
              className="hover:bg-brand-50 dark:hover:bg-ink-700/40 flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {lien.label}
                  {lien.affilie && (
                    <span className="text-muted ml-1.5 text-[0.65rem] font-medium">
                      lien partenaire
                    </span>
                  )}
                </span>
                {lien.note && (
                  <span className="text-muted block text-xs leading-snug">{lien.note}</span>
                )}
              </span>
              <ExternalLink className="text-muted size-4 shrink-0" aria-hidden />
              <span className="sr-only">(s’ouvre dans un nouvel onglet)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function jour(date: string | null): string {
  if (!date) return '';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
