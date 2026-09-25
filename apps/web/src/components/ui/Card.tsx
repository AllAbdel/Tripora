import type { ComponentProps, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Conteneur de base : les contenus de Tripora sont des cartes, pas des lignes. */
// `ComponentProps<'div'>` : la `ref` traverse jusqu'au conteneur (React 19).
export function Card({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      {...rest}
      className={cn(
        'surface-raised rounded-[var(--radius-card)] border border-[color:var(--border-subtle)]',
        'shadow-[var(--shadow-card)]',
        className,
      )}
    />
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('p-5', className)} />;
}
