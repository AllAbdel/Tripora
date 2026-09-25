import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-[color:var(--accent-contrast)] hover:bg-brand-600 active:bg-brand-700 shadow-[var(--shadow-float)]',
  secondary:
    'surface-raised text-[color:var(--text-strong)] border border-[color:var(--border-subtle)] hover:bg-brand-50 dark:hover:bg-ink-700/40',
  ghost: 'text-[color:var(--text-muted)] hover:bg-brand-50 dark:hover:bg-ink-700/40',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const SIZES: Record<Size, string> = {
  // 44 px minimum : la cible tactile recommandée, atteignable au pouce.
  sm: 'h-10 px-3.5 text-sm gap-1.5',
  md: 'h-12 px-5 text-[0.95rem] gap-2',
  lg: 'h-14 px-6 text-base gap-2.5',
};

/**
 * L'apparence d'un bouton, pour un lien qui en joue le rôle.
 *
 * « Créer un voyage » sur l'accueil change de page : c'est un lien, et il doit
 * le rester (clic du milieu, adresse au survol, lecteurs d'écran). Il porte
 * seulement l'habit du bouton.
 */
export function classesDeBouton({
  variant = 'primary',
  size = 'md',
  block = false,
}: { variant?: Variant; size?: Size; block?: boolean } = {}): string {
  return cn(
    // Un rectangle à peine adouci, pas une pilule. La pilule est la forme
    // par défaut de toutes les interfaces générées : elle n'appartient à
    // personne. Le même rayon que les cartes fait, lui, une famille.
    'inline-flex items-center justify-center rounded-[var(--radius-card)] font-semibold',
    'transition-[background-color,transform,box-shadow] duration-200',
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    block && 'w-full',
  );
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  block = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(classesDeBouton({ variant, size, block }), className)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
