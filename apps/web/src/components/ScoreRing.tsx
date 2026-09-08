import { cn } from '@/lib/cn';

/**
 * Note sur 100, en anneau. La couleur suit la note, mais le chiffre reste
 * lisible seul : la couleur n'est jamais la seule information.
 */
export function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;

  // L'échelle suit la couleur choisie plutôt qu'une seconde teinte figée :
  // un anneau turquoise sur une interface devenue rouge ne dit plus « très
  // bon », il dit « raté ». L'or reste pour le milieu, parce qu'il se lit
  // comme une réserve dans à peu près toutes les cultures visuelles.
  const tone =
    score >= 80 ? 'text-brand-600 dark:text-brand-400'
    : score >= 60 ? 'text-brand-400 dark:text-brand-300'
    : score >= 40 ? 'text-gold-500'
    : 'text-[color:var(--text-muted)]';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="4"
          className="stroke-[color:var(--border-subtle)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className={cn('stroke-current transition-[stroke-dasharray] duration-700', tone)}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 grid place-items-center text-sm font-bold tabular-nums',
          tone,
        )}
      >
        {score}
      </span>
      <span className="sr-only">{score} sur 100</span>
    </div>
  );
}
