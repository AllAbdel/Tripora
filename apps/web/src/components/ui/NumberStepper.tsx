import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Compteur à deux boutons. Sur mobile, c'est nettement plus rapide qu'un champ
 * numérique : pas de clavier à ouvrir, pas de saisie à corriger.
 */
export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  label,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
  suffix?: string;
}) {
  const step = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--border-subtle)] surface-raised p-3">
      <span className="pl-1 font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <StepperButton onClick={() => step(-1)} disabled={value <= min} label={`Moins`}>
          <Minus className="size-4" aria-hidden />
        </StepperButton>
        <output
          aria-live="polite"
          className="min-w-14 text-center text-lg font-bold tabular-nums"
        >
          {value}
          {suffix && <span className="text-muted ml-1 text-sm font-medium">{suffix}</span>}
        </output>
        <StepperButton onClick={() => step(1)} disabled={value >= max} label={`Plus`}>
          <Plus className="size-4" aria-hidden />
        </StepperButton>
      </div>
    </div>
  );
}

function StepperButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'grid size-11 place-items-center rounded-full border border-[color:var(--border-subtle)]',
        'transition-colors active:scale-95 disabled:opacity-40',
        !disabled && 'hover:border-brand-400 hover:text-brand-500',
      )}
    >
      {children}
    </button>
  );
}
