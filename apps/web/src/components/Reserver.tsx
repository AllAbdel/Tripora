import { ExternalLink } from 'lucide-react';
import {
  activityLinks,
  liensDeRubrique,
  sejourDe,
  affilierLiens,
  stayLinks,
  TITRES_DES_RUBRIQUES,
  type RubriqueDePartenaire,
  travelLinks,
  type BookingLink,
  type Destination,
  type TripConstraints,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { env } from '@/lib/env';
import { TitreDeSection } from '@/components/TitreDePage';
import type { NomDePastille } from '@/components/Pastille';

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
  const dormir = affilierLiens(stayLinks(destination, sejour), env.travelpayouts);
  const aller = affilierLiens(
    travelLinks(constraints.origin, destination, sejour),
    env.travelpayouts,
  );
  const faire = affilierLiens(activityLinks(destination), env.travelpayouts);
  const surPlace = RUBRIQUES_SUR_PLACE.map((rubrique) => ({
    rubrique,
    liens: affilierLiens(liensDeRubrique(rubrique, destination), env.travelpayouts),
  })).filter((groupe) => groupe.liens.length > 0);
  const commissionne = [...dormir, ...aller, ...faire, ...surPlace.flatMap((g) => g.liens)].some(
    (lien) => lien.affilie,
  );

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

        <Groupe titre="Où dormir" pastille="hebergements" liens={dormir} />
        <Groupe titre="Comment y aller" pastille="transport" liens={aller} />
        <Groupe titre="Que faire sur place" pastille="decouvrir" liens={faire} />
        <SurPlace groupes={surPlace} />

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

function Groupe({
  titre,
  pastille,
  liens,
}: {
  titre: string;
  pastille: NomDePastille;
  liens: BookingLink[];
}) {
  if (liens.length === 0) return null;
  return (
    <section className="space-y-1.5">
      <TitreDeSection pastille={pastille} niveau="h3">
        {titre}
      </TitreDeSection>
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

/** Ce qui sert une fois arrivé, dans l'ordre où on en a besoin. */
const RUBRIQUES_SUR_PLACE: readonly RubriqueDePartenaire[] = [
  'internet',
  'transfert',
  'voiture',
  'deux-roues',
  'bagages',
];

const AIDE_DES_RUBRIQUES: Partial<Record<RubriqueDePartenaire, string>> = {
  internet: 'Une eSIM s’installe avant de partir : le forfait démarre en arrivant, sans carte à changer.',
  transfert: 'Un chauffeur réservé d’avance, à prix fixé, qui attend à la sortie.',
  bagages: 'Pour le dernier jour, entre le départ de l’hôtel et l’avion.',
};

/**
 * Ce qui sert une fois arrivé : internet, l'aéroport, la voiture, les
 * bagages. En pastilles plutôt qu'en lignes : ce sont des sites qu'on
 * reconnaît, pas des recherches préremplies — le détail de chacun reste
 * lisible au survol et pour les lecteurs d'écran.
 */
function SurPlace({
  groupes,
}: {
  groupes: { rubrique: RubriqueDePartenaire; liens: BookingLink[] }[];
}) {
  if (groupes.length === 0) return null;
  return (
    <section className="space-y-3">
      <TitreDeSection pastille="carte" niveau="h3">
        Sur place
      </TitreDeSection>
      {groupes.map(({ rubrique, liens }) => (
        <div key={rubrique} className="space-y-1.5">
          <h4 className="text-sm font-semibold">{TITRES_DES_RUBRIQUES[rubrique]}</h4>
          {AIDE_DES_RUBRIQUES[rubrique] && (
            <p className="text-muted text-xs leading-snug">{AIDE_DES_RUBRIQUES[rubrique]}</p>
          )}
          <ul className="flex flex-wrap gap-2">
            {liens.map((lien) => (
              <li key={lien.id}>
                <a
                  href={lien.url}
                  target="_blank"
                  rel={lien.affilie ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
                  title={lien.note}
                  className="hover:bg-brand-50 dark:hover:bg-ink-700/40 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color:var(--border-subtle)] px-3.5 text-sm font-medium"
                >
                  {lien.label}
                  <ExternalLink className="text-muted size-3.5" aria-hidden />
                  <span className="sr-only">
                    {lien.note ? ` — ${lien.note}` : ''}
                    {lien.affilie ? ' (lien partenaire)' : ''} (s’ouvre dans un nouvel onglet)
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groupes.some((groupe) => groupe.liens.some((lien) => lien.affilie)) && (
        <p className="text-muted text-xs">Liens partenaires.</p>
      )}
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
