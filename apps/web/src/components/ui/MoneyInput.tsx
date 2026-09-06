import { cn } from '@/lib/cn';

/**
 * Saisie d'un montant.
 *
 * Volontairement en `type="text"` et non `type="number"` : un champ numérique
 * refuse la virgule décimale, alors qu'un francophone tape naturellement
 * « 48,50 ». La saisie était rejetée en silence, sans le moindre message —
 * le pire des comportements. `inputMode="decimal"` conserve le pavé numérique
 * sur mobile, et le filtre ci-dessous empêche d'entrer autre chose qu'un
 * nombre.
 *
 * La conversion en centimes reste faite par `parseAmountToCents`, qui accepte
 * les deux séparateurs.
 */
export function MoneyInput({
  value,
  onChange,
  placeholder,
  label,
  className,
  entier = false,
}: {
  value: string;
  onChange: (valeur: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
  /** Pas de décimales attendues : budgets, enveloppes. */
  entier?: boolean;
}) {
  const motif = entier ? /[^\d]/g : /[^\d.,]/g;

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          const nettoye = event.target.value.replace(motif, '');
          // Une seule virgule, sinon « 12,5,3 » deviendrait illisible.
          const parties = nettoye.split(/[.,]/);
          onChange(
            parties.length > 2
              ? `${parties[0]},${parties.slice(1).join('').slice(0, 2)}`
              : nettoye,
          );
        }}
        className={cn(
          'h-12 w-full rounded-2xl border border-[color:var(--border-subtle)] surface-raised',
          'pr-10 pl-4 text-[16px] outline-none transition-colors focus:border-brand-500',
          className,
        )}
      />
      <span
        aria-hidden
        className="text-muted pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
      >
        €
      </span>
    </div>
  );
}
