import type { ReactNode } from 'react';
import { Info, TriangleAlert, WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'warning' | 'offline';

const TONES: Record<Tone, { className: string; icon: ReactNode }> = {
  info: {
    className: 'border-brand-500 bg-brand-50/60 text-brand-800 dark:bg-brand-900/25 dark:text-brand-100',
    icon: <Info className="size-4 shrink-0" aria-hidden />,
  },
  warning: {
    className: 'border-gold-500 bg-gold-300/15 text-gold-700 dark:bg-gold-700/15 dark:text-gold-300',
    icon: <TriangleAlert className="size-4 shrink-0" aria-hidden />,
  },
  offline: {
    className: 'border-[color:var(--border-fort)] bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]',
    icon: <WifiOff className="size-4 shrink-0" aria-hidden />,
  },
};

export function Banner({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { className: toneClass, icon } = TONES[tone];
  return (
    <div
      role="status"
      className={cn(
        // Un aplat de couleur sur toute la largeur pèse autant qu'une alerte
        // système. Un filet vertical à gauche signale sans occuper : c'est la
        // marque que l'on porte en marge d'un paragraphe qu'on veut relire.
        'flex gap-3 border-s-2 rounded-e-[var(--radius-card)] px-4 py-3 text-sm',
        toneClass,
        className,
      )}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className="[&_a]:underline">{children}</div>
      </div>
    </div>
  );
}
