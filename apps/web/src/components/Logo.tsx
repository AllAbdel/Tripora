import { cn } from '@/lib/cn';

/**
 * Marque de Tripora : un repère de carte, un groupe à l'intérieur, la note du
 * groupe au-dessus. Version simplifiée de l'icône, lisible dès 20 pixels.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-9', className)} role="img" aria-label="Tripora">
      <defs>
        <linearGradient id="logo-fond" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3fb0ff" />
          <stop offset="1" stopColor="#0066f0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#logo-fond)" />
      <path
        d="M24 41c0 0-11-9.6-11-17.7a11 11 0 1 1 22 0C35 31.4 24 41 24 41z"
        fill="#ffffff"
      />
      <circle cx="24" cy="23" r="8.2" fill="none" stroke="#1c8c9b" strokeWidth="1.6" />
      <g fill="#1f3a6e">
        <circle cx="19.4" cy="20.4" r="1.5" />
        <circle cx="24" cy="19.9" r="1.6" />
        <circle cx="28.6" cy="20.4" r="1.5" />
        <rect x="18.4" y="22.4" width="2" height="6" rx="1" />
        <rect x="23" y="21.9" width="2.1" height="6.6" rx="1.05" />
        <rect x="27.6" y="22.4" width="2" height="6" rx="1" />
      </g>
      <g fill="#f5b301">
        <path d="M24 3.4l1.5 3 3.3.5-2.4 2.3.6 3.3L24 10.9l-3 1.6.6-3.3L19.2 6.9l3.3-.5z" />
      </g>
    </svg>
  );
}
