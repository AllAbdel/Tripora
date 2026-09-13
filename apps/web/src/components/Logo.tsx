import { cn } from '@/lib/cn';

/**
 * La marque de Tripora : une montagne enneigée, un soleil, et un avion qui
 * décolle en suivant la vallée.
 *
 * Même dessin que l'icône de l'application, redessiné en vectoriel pour rester
 * net à toutes les tailles. Les identifiants de dégradé sont préfixés : deux
 * logos sur une même page partageraient sinon les mêmes, et le dernier monté
 * l'emporterait.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('size-9', className)} role="img" aria-label="Tripora">
      <defs>
        <linearGradient id="logo-ciel" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#153f88" />
          <stop offset="0.55" stopColor="#0b4c99" />
          <stop offset="1" stopColor="#0571a7" />
        </linearGradient>
        <linearGradient id="logo-vallee" x1="0.15" y1="0.15" x2="0.9" y2="0.95">
          <stop offset="0" stopColor="#2f8fe0" />
          <stop offset="0.5" stopColor="#2ec5cf" />
          <stop offset="1" stopColor="#41dfa4" />
        </linearGradient>
        <linearGradient id="logo-astre" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc85a" />
          <stop offset="1" stopColor="#f39a1c" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="118" fill="url(#logo-ciel)" />
      <circle cx="358" cy="139" r="42" fill="url(#logo-astre)" />

      {/* La montagne : sommet enneigé à gauche, versant bleu qui plonge à droite. */}
      <path d="M104 318 214 152l60 90 34-44 96 120z" fill="#eef4fa" />
      <path d="M274 242l34-44 96 120H236z" fill="#1c68c8" />
      <path d="M214 152l30 45-31 24-27-22z" fill="#ffffff" />

      {/* La vallée en deux temps : un liseré blanc qui borde le creux par
          l'extérieur, puis la courbe turquoise par-dessus. C'est le liseré qui
          détache la forme du fond bleu. */}
      <path
        d="M92 262c-14 96 44 172 148 172 84 0 152-46 214-146-30 122-116 194-222 194C122 482 68 396 92 262z"
        fill="#f2f8fd"
      />
      <path
        d="M122 268c-10 80 40 142 128 142 76 0 138-42 196-132-24 104-100 164-196 164-96 0-142-70-128-174z"
        fill="url(#logo-vallee)"
      />

      {/* L'avion, dessiné droit puis incliné : tracé directement en oblique, il
          faudrait poser une dizaine de points sur une diagonale, et le moindre
          écart donne un chevron plutôt qu'un avion. */}
      <g transform="translate(360 212) rotate(46) scale(1.28) translate(-50 -60)">
        <path
          d="M50 4c8 0 14 16 14 36l32 26v11L64 63v25l13 13v9L50 101l-27 9v-9l13-13V63L4 77V66l32-26C36 20 42 4 50 4z"
          fill="#ffffff"
        />
      </g>
    </svg>
  );
}
