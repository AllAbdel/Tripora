import { cn } from '@/lib/cn';

/** Barre d'avancement du questionnaire : savoir combien il reste rassure. */
export function Progress({ current, total }: { current: number; total: number }) {
  const percent = Math.round(((current + 1) / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Étape ${current + 1} sur ${total}`}
      className="flex gap-1.5"
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors duration-300',
            index <= current ? 'bg-brand-500' : 'bg-[color:var(--border-subtle)]',
          )}
        />
      ))}
      <span className="sr-only">{percent} %</span>
    </div>
  );
}
