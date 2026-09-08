import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Grande tuile sélectionnable. Préférée aux listes déroulantes et aux boutons
 * radio : plus lisible, plus facile à viser au pouce, et elle laisse la place
 * d'expliquer chaque option en une ligne.
 */
export function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  compact = false,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  title: string;
  description?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-2xl border p-4 text-left',
        'transition-[border-color,background-color,transform] duration-200 active:scale-[0.99]',
        compact && 'p-3',
        selected
          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40'
          : 'border-[color:var(--border-subtle)] surface-raised hover:border-brand-300',
      )}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            selected ? 'bg-brand-500 text-[color:var(--accent-contrast)]' : 'bg-[color:var(--surface-muted)] text-muted',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {description && (
          <span className="text-muted mt-0.5 block text-sm leading-snug">{description}</span>
        )}
      </span>
      {selected && <Check className="text-brand-500 size-5 shrink-0" aria-hidden />}
    </button>
  );
}
