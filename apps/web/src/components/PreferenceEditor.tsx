import {
  AXIS_ICON,
  AXIS_LABELS_FR,
  PREFERENCE_AXES,
  PREFERENCE_LEVELS,
  type PreferenceAxis,
  type PreferenceWeights,
} from '@tripora/core';
import { cn } from '@/lib/cn';
import { Icone } from '@/components/Icone';

/**
 * Saisie des envies en quatre paliers plutôt qu'en pourcentages.
 *
 * Un curseur au pourcent près est pénible au pouce, et personne ne fait la
 * différence entre 60 % et 65 % de goût pour les musées. Quatre paliers se
 * choisissent d'un geste et donnent au moteur exactement ce dont il a besoin.
 *
 * Un axe sans réponse n'affiche aucune sélection : « pas encore répondu » et
 * « non merci » ne veulent pas dire la même chose, et le formulaire ne doit
 * jamais faire dire à quelqu'un ce qu'il n'a pas dit.
 */
export function PreferenceEditor({
  weights,
  onChange,
}: {
  weights: Partial<PreferenceWeights>;
  onChange: (axis: PreferenceAxis, value: number) => void;
}) {
  return (
    <div className="space-y-3">
      {PREFERENCE_AXES.map((axis) => (
        <AxisRow key={axis} axis={axis} value={weights[axis]} onChange={onChange} />
      ))}
    </div>
  );
}

function AxisRow({
  axis,
  value,
  onChange,
}: {
  axis: PreferenceAxis;
  value: number | undefined;
  onChange: (axis: PreferenceAxis, value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border-subtle)] surface-raised p-3">
      <p className="mb-2 flex items-center gap-2 pl-1 font-semibold">
        <Icone nom={AXIS_ICON[axis]} className="text-brand-500 size-4" />
        {AXIS_LABELS_FR[axis]}
      </p>
      <div role="radiogroup" aria-label={AXIS_LABELS_FR[axis]} className="grid grid-cols-4 gap-1.5">
        {PREFERENCE_LEVELS.map((level) => {
          const selected = value !== undefined && Math.abs(value - level.value) < 0.01;
          return (
            <button
              key={level.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(axis, level.value)}
              className={cn(
                'min-h-11 rounded-xl border px-0.5 text-[0.72rem] leading-tight font-medium transition-colors',
                selected
                  ? 'border-brand-500 bg-brand-500 text-[color:var(--accent-contrast)]'
                  : 'border-[color:var(--border-subtle)] text-muted hover:border-brand-300',
              )}
            >
              {level.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
