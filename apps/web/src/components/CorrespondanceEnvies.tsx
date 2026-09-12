import { Check, Minus, TriangleAlert } from 'lucide-react';
import type { Correspondance, CorrespondanceAxe } from '@tripora/core';
import { Icone } from '@/components/Icone';
import { cn } from '@/lib/cn';

/**
 * Ce que la destination vaut sur chacune de vos envies.
 *
 * La note globale d'une proposition mélange six facteurs : elle sert à
 * classer, pas à décider. Quelqu'un qui a coché « nature : essentiel » veut
 * savoir si cette ville-là a de la nature, pas si elle fait 82 sur 100 toutes
 * causes confondues. On rouvre donc la boîte, envie par envie.
 *
 * La barre montre la part de l'envie couverte, pas la note absolue de la ville
 * sur l'axe : une ville à 5/10 en fête comble qui en voulait un peu et déçoit
 * qui en faisait une condition. C'est la même donnée, et c'est la seconde
 * lecture qui aide à choisir.
 */

const TONS = {
  comble: {
    barre: 'bg-lagoon-500',
    texte: 'text-lagoon-700 dark:text-lagoon-300',
    Icone: Check,
    mot: 'comblé',
  },
  correct: {
    barre: 'bg-brand-500',
    texte: 'text-muted',
    Icone: Minus,
    mot: 'correct',
  },
  faible: {
    barre: 'bg-gold-500',
    texte: 'text-gold-700 dark:text-gold-300',
    Icone: TriangleAlert,
    mot: 'faible',
  },
} as const;

/** La ligne courte, toujours visible sur la carte. */
export function ResumeDesEnvies({ correspondance }: { correspondance: Correspondance }) {
  if (correspondance.axes.length === 0) return null;
  const manques = correspondance.axes.filter((axe) => axe.verdict === 'faible').length;
  return (
    <p className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
          manques === 0
            ? 'bg-lagoon-50 text-lagoon-700 dark:bg-lagoon-900/50 dark:text-lagoon-200'
            : 'bg-gold-50 text-gold-700 dark:bg-gold-900/50 dark:text-gold-200',
        )}
      >
        {correspondance.couvertureGlobale} %
      </span>
      <span className="text-muted min-w-0 flex-1">{correspondance.resume}</span>
    </p>
  );
}

/** Le détail, envie par envie, dans la section dépliée. */
export function DetailDesEnvies({ correspondance }: { correspondance: Correspondance }) {
  if (correspondance.axes.length === 0) {
    return (
      <p className="text-muted text-sm">
        Personne n’a encore renseigné ses envies : il n’y a rien à comparer.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <ul className="space-y-2">
        {correspondance.axes.map((axe) => (
          <LigneDEnvie key={axe.axis} axe={axe} />
        ))}
      </ul>

      {correspondance.rejets.length > 0 && (
        <ul className="space-y-1 border-t border-[color:var(--border-subtle)] pt-2">
          {correspondance.rejets.map((rejet) => (
            <li
              key={rejet.axis}
              className="text-gold-700 dark:text-gold-300 flex items-start gap-2 text-xs"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>{rejet.phrase}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LigneDEnvie({ axe }: { axe: CorrespondanceAxe }) {
  const ton = TONS[axe.verdict];
  return (
    <li className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <Icone nom={axe.icon} className="text-muted size-4 shrink-0" />
          <span className="truncate">{axe.label}</span>
        </span>
        <span className={cn('shrink-0 text-xs font-semibold tabular-nums', ton.texte)}>
          {axe.couverture} %
          <span className="sr-only"> de cette envie, {ton.mot}</span>
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-[color:var(--border-subtle)]"
        aria-hidden
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', ton.barre)}
          style={{ width: `${axe.couverture}%` }}
        />
      </div>
      <p className="text-muted text-xs">{axe.phrase}</p>
    </li>
  );
}
