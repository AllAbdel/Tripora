import {
  cheapestTransport,
  costLines,
  describeSource,
  estimateTripCost,
  formatCents,
  type Destination,
  type PricedValue,
  type TripConstraints,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * Ce qui était prévu, et ce qui a été dépensé.
 *
 * L'écran des dépenses savait très bien compter ce qu'on avait sorti, et pas
 * du tout le rapporter à quoi que ce soit. « 640 € dépensés » ne dit rien sans
 * le budget annoncé au départ : c'est la moitié de l'enveloppe ou le double,
 * et c'est toute la différence.
 *
 * Le prévu vient de deux endroits, et les deux sont affichés pour ce qu'ils
 * sont : le budget que le groupe s'est donné, qui est une décision, et
 * l'estimation du coût de la destination, qui est un calcul.
 */
export function PrevuEtReel({
  constraints,
  destination,
  prixDuVol,
  depenseCents,
  participants,
}: {
  constraints: TripConstraints;
  /** La destination retenue. Sans elle, on ne peut estimer que le budget annoncé. */
  destination?: Destination | undefined;
  /** Prix de vol relevé, quand il y en a un : il remplace l'estimation. */
  prixDuVol?: PricedValue | undefined;
  /** Total réellement dépensé par le groupe, en centimes. */
  depenseCents: number;
  /** Nombre de personnes qui partagent la note. */
  participants: number;
}) {
  const budgetParPersonne = constraints.budgetPerPersonCents;
  const budgetGroupe = budgetParPersonne === null ? null : budgetParPersonne * participants;

  const transport: PricedValue | null =
    prixDuVol && prixDuVol.cents !== null
      ? prixDuVol
      : destination
        ? (cheapestTransport(constraints.origin, destination, participants)?.price ?? null)
        : null;

  const estimation = destination
    ? estimateTripCost({
        destination,
        durationDays: constraints.durationDays,
        comfortLevel: constraints.comfortLevel,
        transport: transport ?? { cents: 0, source: 'estimated' },
      })
    : null;

  const reference = budgetGroupe ?? (estimation ? estimation.totalCents * participants : null);
  const part = reference && reference > 0 ? Math.min(150, (depenseCents / reference) * 100) : null;
  const depasse = reference !== null && depenseCents > reference;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted text-sm font-medium">Dépensé jusqu’ici</span>
          <span className="text-2xl font-bold tabular-nums">{formatCents(depenseCents)}</span>
        </div>

        {reference !== null && (
          <div className="space-y-1.5">
            <div
              className="h-2 overflow-hidden rounded-full bg-[color:var(--border-subtle)]"
              aria-hidden
            >
              <div
                className={cn(
                  'h-full rounded-full transition-[width] duration-700',
                  depasse ? 'bg-gold-500' : 'bg-lagoon-500',
                )}
                style={{ width: `${Math.max(2, part ?? 0)}%` }}
              />
            </div>
            <p className={cn('text-xs', depasse ? 'text-gold-700 dark:text-gold-300' : 'text-muted')}>
              {depasse
                ? `Vous avez dépassé de ${formatCents(depenseCents - reference)} ce qui était prévu (${formatCents(reference)} pour ${participants}).`
                : `Il reste ${formatCents(reference - depenseCents)} sur les ${formatCents(reference)} prévus pour ${participants} personne${participants > 1 ? 's' : ''}.`}
            </p>
          </div>
        )}

        {reference === null && (
          <p className="text-muted text-xs">
            Aucun budget n’a été renseigné à la création, et aucune destination n’est arrêtée :
            il n’y a rien à quoi comparer ces dépenses.
          </p>
        )}

        {estimation && (
          <div className="space-y-1.5 border-t border-[color:var(--border-subtle)] pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">Ce que le voyage devrait coûter</p>
              <span className="text-muted text-xs">par personne</span>
            </div>
            <ul className="space-y-1 text-sm">
              {costLines(estimation).map((ligne) => (
                <li key={ligne.key} className="flex justify-between gap-4">
                  <span className="text-muted">{ligne.label}</span>
                  <span className="tabular-nums">
                    {formatCents(ligne.cents, 'EUR', { hideCentimes: true })}
                  </span>
                </li>
              ))}
              <li className="flex justify-between gap-4 border-t border-[color:var(--border-subtle)] pt-1 font-semibold">
                <span>Total estimé</span>
                <span className="tabular-nums">
                  {formatCents(estimation.totalCents, 'EUR', { hideCentimes: true })}
                </span>
              </li>
            </ul>
            {transport && (
              <p className="text-muted pt-0.5 text-xs">
                Transport : {describeSource(transport).court.toLowerCase()}. Le reste est estimé
                à partir du niveau de confort choisi et du coût de la vie sur place.
              </p>
            )}
          </div>
        )}

        {budgetParPersonne !== null && (
          <p className="text-muted border-t border-[color:var(--border-subtle)] pt-3 text-xs">
            Budget annoncé à la création :{' '}
            <strong className="text-[color:var(--text-strong)]">
              {formatCents(budgetParPersonne, 'EUR', { hideCentimes: true })} par personne
            </strong>
            {estimation && estimation.totalCents > budgetParPersonne && (
              <>
                {' '}— l’estimation le dépasse de{' '}
                {formatCents(estimation.totalCents - budgetParPersonne, 'EUR', {
                  hideCentimes: true,
                })}
                .
              </>
            )}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
