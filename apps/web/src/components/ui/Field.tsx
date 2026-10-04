import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-muted block text-xs">{hint}</span>}
    </label>
  );
}

// `ComponentProps<'input'>` plutôt que les seuls attributs : depuis React 19,
// `ref` est une prop comme une autre, et elle traverse jusqu'au champ.
export function TextInput({ className, ...rest }: ComponentProps<'input'>) {
  return (
    <input
      {...rest}
      className={cn(
        'h-12 w-full rounded-2xl border border-[color:var(--border-subtle)] surface-raised px-4',
        'text-[16px] outline-none transition-colors', // 16 px : évite le zoom automatique sur iOS
        'focus:border-brand-500',
        className,
      )}
    />
  );
}
