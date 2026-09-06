import type { ReactNode } from 'react';
import { Info, TriangleAlert, WifiOff } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'info' | 'warning' | 'offline';

const TONES: Record<Tone, { className: string; icon: ReactNode }> = {
  info: {
    className: 'bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-100',
    icon: <Info className="size-4 shrink-0" aria-hidden />,
  },
  warning: {
    className: 'bg-gold-300/25 text-gold-700 dark:bg-gold-700/25 dark:text-gold-300',
    icon: <TriangleAlert className="size-4 shrink-0" aria-hidden />,
  },
  offline: {
    className: 'bg-ink-700/10 text-[color:var(--text-muted)] dark:bg-ink-700/40',
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
      className={cn('flex gap-3 rounded-2xl px-4 py-3 text-sm', toneClass, className)}
    >
      <span className="mt-0.5">{icon}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className="[&_a]:underline">{children}</div>
      </div>
    </div>
  );
}
