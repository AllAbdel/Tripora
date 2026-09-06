import type { ReactNode } from 'react';

/** Un écran vide doit expliquer quoi faire, pas se contenter d'être vide. */
export function EmptyState({
  illustration,
  title,
  description,
  action,
}: {
  illustration?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="animate-rise flex flex-col items-center gap-4 px-6 py-14 text-center">
      {illustration}
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted mx-auto max-w-sm text-sm leading-relaxed">{description}</p>
      </div>
      {action}
    </div>
  );
}
