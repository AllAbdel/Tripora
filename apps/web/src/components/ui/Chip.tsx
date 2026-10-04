import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors',
        selected
          ? 'border-brand-500 bg-brand-500 text-[color:var(--accent-contrast)]'
          : 'border-[color:var(--border-subtle)] text-muted surface-raised hover:border-brand-300',
        className,
      )}
    >
      {children}
    </button>
  );
}
