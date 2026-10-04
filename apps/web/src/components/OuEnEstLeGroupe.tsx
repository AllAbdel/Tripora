import { AlertCircle, Check, ChevronDown, Circle } from 'lucide-react';
import { tripReadiness, type MemberPreference, type TripConstraints } from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

/**
 * « Où on en est », en haut du voyage.
 *
 * La raison pour laquelle un voyage entre amis n'avance pas n'est presque
 * jamais le manque d'idées : c'est que personne ne sait ce qu'on attend, ni de
 * qui. Deux personnes attendent qu'on leur demande, trois croient avoir
 * répondu, et le groupe conclut que l'appli ne sert à rien.
 *
 * Ce bloc répond à une seule question : qu'est-ce qui bloque, maintenant. Il
 * ne nomme personne — la pression sociale n'est pas une fonctionnalité — et il
 * dit ce que chaque manque empêche, parce qu'« il manque 2 réponses » ne
 * motive personne alors qu'« on ne peut pas garantir que personne ne subit »
 * se comprend tout de suite.
 *
 * Il disparaît quand tout est en place : un écran qui félicite est un écran
 * qui prend de la place pour rien.
 *
 * Depuis qu'un « prochain geste » unique le surmonte, le détail est **replié**.
 * Les deux disaient la même chose de deux façons, et deux appels à l'action
 * côte à côte n'en font aucun. Ce bloc redevient ce qu'il aurait toujours dû
 * être : la réponse à « pourquoi ? », consultable et non imposée. Seule la
 * barre d'avancement reste visible, parce qu'elle se lit d'un coup d'œil et
 * qu'elle ne demande rien.
 */
export function OuEnEstLeGroupe({
  constraints,
  members,
  votes,
  locked,
}: {
  constraints: TripConstraints;
  members: readonly MemberPreference[];
  /** Nombre de personnes ayant voté au moins une fois. */
  votes: number;
  locked: boolean;
}) {
  const etat = tripReadiness({ constraints, members, votes, locked });
  if (etat.blockers.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <details className="group">
          {/* La barre vit dans le résumé : elle se lit d'un coup d'œil et ne
              demande rien, donc elle reste visible même replié. */}
          <summary
            className={cn(
              'block cursor-pointer list-none space-y-2.5',
              '[&::-webkit-details-marker]:hidden',
            )}
          >
            <span className="flex min-h-9 items-baseline justify-between gap-3">
              <span className="flex items-center gap-1.5 font-bold">
                Où on en est
                <ChevronDown
                  className="text-muted size-4 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </span>
              <span className="text-muted text-sm tabular-nums">{etat.progress} %</span>
            </span>

            <span
              role="progressbar"
              aria-valuenow={etat.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Avancement du groupe"
              className="block h-1.5 overflow-hidden rounded-full bg-[color:var(--border-subtle)]"
            >
              <span
                className="bg-brand-500 block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${etat.progress}%` }}
              />
            </span>
          </summary>

          <div className="space-y-3 pt-3.5">{detail(etat)}</div>
        </details>
      </CardBody>
    </Card>
  );
}

/** Le détail, replié par défaut : ce qui manque, et ce que ça empêche. */
function detail(etat: ReturnType<typeof tripReadiness>) {
  return (
    <>
      <ul className="space-y-2">
        {etat.blockers.map((blocage) => (
          <li key={blocage.kind} className="flex items-start gap-2.5">
            {blocage.blocking ? (
              <AlertCircle
                className="text-gold-600 dark:text-gold-400 mt-0.5 size-4 shrink-0"
                aria-hidden
              />
            ) : (
              <Circle className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{blocage.label}</span>
              <span className="text-muted block text-xs leading-snug">
                {blocage.consequence}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {etat.readyToDecide && (
        <p className="text-lagoon-700 dark:text-lagoon-300 flex items-center gap-2 text-sm font-medium">
          <Check className="size-4 shrink-0" aria-hidden />
          Le groupe a tout ce qu’il faut pour trancher.
        </p>
      )}
    </>
  );
}
