import { cn } from '@/lib/cn';

/**
 * La note d'une destination, sur cent.
 *
 * C'était un anneau de progression — le beignet de tableau de bord, la forme
 * qu'on trouve dans toutes les interfaces de suivi. Il se lisait bien, mais il
 * disait « indicateur », alors qu'il s'agit d'une appréciation : quelque chose
 * de plus proche d'une note dans une marge que d'une jauge de batterie.
 *
 * Le chiffre passe donc en grand dans la romane, avec sa mention en petites
 * capitales, et la proportion se lit sur un filet plutôt que sur un cercle.
 * Un filet occupe moins de place, se compose avec le reste de la page — qui
 * en est faite — et laisse le chiffre être ce qu'il est : le sujet.
 *
 * La couleur suit la note, sans jamais la porter seule : le chiffre reste
 * lisible pour qui ne distingue pas les teintes.
 */
export function Notation({ note, className }: { note: number; className?: string }) {
  const borne = Math.min(100, Math.max(0, Math.round(note)));

  // L'échelle suit l'accent choisi plutôt qu'une seconde teinte figée : un
  // repère turquoise sur une interface devenue rouge ne dit plus « très bon »,
  // il dit « raté ». L'or tient le milieu, parce qu'il se lit comme une
  // réserve dans à peu près toutes les cultures visuelles.
  const ton =
    borne >= 80 ? 'text-brand-600 dark:text-brand-300'
    : borne >= 60 ? 'text-brand-500 dark:text-brand-400'
    : borne >= 40 ? 'text-gold-600 dark:text-gold-300'
    : 'text-[color:var(--text-muted)]';

  return (
    <div className={cn('w-14 shrink-0 text-end', className)}>
      <span className={cn('titre chiffres block text-[2rem] leading-none', ton)} aria-hidden>
        {borne}
      </span>
      <span
        aria-hidden
        className="mt-1.5 block h-px w-full bg-[color:var(--border-subtle)]"
      >
        <span className={cn('block h-px bg-current', ton)} style={{ width: `${borne}%` }} />
      </span>
      <span className="etiquette mt-1 block text-[0.5625rem]" aria-hidden>
        sur 100
      </span>
      <span className="sr-only">{borne} sur 100</span>
    </div>
  );
}
