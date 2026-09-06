import { Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { VoteTally, VoteValue } from '@/lib/votes';

/**
 * Trois gestes, pas plus : j'aime, je n'aime pas, mon préféré.
 *
 * Recliquer sur son propre choix le retire — un geste pour poser, le même pour
 * reprendre, sans bouton « annuler » supplémentaire à chercher.
 */
const CHOIX: { value: VoteValue; label: string; icon: typeof ThumbsUp; actif: string }[] = [
  { value: 'like', label: 'J’aime', icon: ThumbsUp, actif: 'bg-lagoon-500 text-white border-lagoon-500' },
  { value: 'favorite', label: 'Mon préféré', icon: Star, actif: 'bg-gold-500 text-white border-gold-500' },
  { value: 'dislike', label: 'Pas pour moi', icon: ThumbsDown, actif: 'bg-ink-700 text-white border-ink-700' },
];

export function VoteBar({
  tally,
  participants,
  disabled = false,
  onVote,
}: {
  tally: VoteTally | undefined;
  participants: number;
  disabled?: boolean;
  onVote: (value: VoteValue | null) => void;
}) {
  const pour = (tally?.likes ?? 0) + (tally?.favorites ?? 0);
  const contre = tally?.dislikes ?? 0;
  const exprimes = pour + contre;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {CHOIX.map(({ value, label, icon: Icon, actif }) => {
          const choisi = tally?.mine === value;
          const compte =
            value === 'like' ? (tally?.likes ?? 0)
            : value === 'favorite' ? (tally?.favorites ?? 0)
            : (tally?.dislikes ?? 0);

          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              aria-pressed={choisi}
              aria-label={`${label}${compte > 0 ? ` (${compte})` : ''}`}
              onClick={() => onVote(choisi ? null : value)}
              className={cn(
                'flex min-h-11 items-center justify-center gap-1.5 rounded-xl border text-sm font-medium',
                'transition-colors active:scale-[0.97] disabled:opacity-50',
                choisi
                  ? actif
                  : 'border-[color:var(--border-subtle)] text-muted hover:border-brand-300',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {compte > 0 && <span className="tabular-nums">{compte}</span>}
            </button>
          );
        })}
      </div>

      {exprimes > 0 && (
        <p className="text-muted text-center text-xs" aria-live="polite">
          {resumeDuVote(pour, contre, participants)}
        </p>
      )}
    </div>
  );
}

/** Une phrase, pas un tableau de bord : ce qui compte est « est-ce que ça passe ? ». */
function resumeDuVote(pour: number, contre: number, participants: number): string {
  if (pour > 0 && contre === 0) {
    return pour >= participants
      ? 'Tout le monde est d’accord'
      : `${pour} sur ${participants} sont pour`;
  }
  if (pour === 0) {
    return contre === 1 ? '1 personne n’en veut pas' : `${contre} personnes n’en veulent pas`;
  }
  return `${pour} pour, ${contre} contre`;
}
