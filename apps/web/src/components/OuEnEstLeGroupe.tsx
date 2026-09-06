import { AlertCircle, Check, Circle } from 'lucide-react';
import { tripReadiness, type MemberPreference, type TripConstraints } from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';

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
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold">Où on en est</h2>
          <span className="text-muted text-sm tabular-nums">{etat.progress} %</span>
        </div>

        <div
          role="progressbar"
          aria-valuenow={etat.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avancement du groupe"
          className="h-1.5 overflow-hidden rounded-full bg-[color:var(--border-subtle)]"
        >
          <div
            className="bg-lagoon-500 h-full rounded-full transition-[width] duration-500"
            style={{ width: `${etat.progress}%` }}
          />
        </div>

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
      </CardBody>
    </Card>
  );
}
