import { BedDouble, Coins, PiggyBank, Sparkle } from 'lucide-react';
import { formatCents, parseAmountToCents, type BudgetMode, type ComfortLevel } from '@tripora/core';
import { OptionCard } from '@/components/ui/OptionCard';
import { Chip } from '@/components/ui/Chip';
import { Field } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { useTripDraft } from '@/stores/tripDraft';

const MODES: { value: BudgetMode; label: string; description: string; icon: typeof Coins }[] = [
  {
    value: 'cheapest',
    label: 'Le moins cher possible',
    description: 'Tripora classera les destinations par coût total croissant.',
    icon: PiggyBank,
  },
  {
    value: 'max_per_person',
    label: 'Un maximum par personne',
    description: 'Rien au-dessus ne sera proposé au groupe.',
    icon: Coins,
  },
  {
    value: 'comfortable',
    label: 'On veut être à l’aise',
    description: 'Le confort compte autant que le prix.',
    icon: Sparkle,
  },
];

const COMFORTS: { value: ComfortLevel; label: string; description: string }[] = [
  { value: 'budget', label: 'Petit budget', description: 'Auberge ou logement partagé, cuisine locale' },
  { value: 'mid', label: 'Intermédiaire', description: 'Hôtel simple ou appartement, restaurants' },
  { value: 'comfort', label: 'Confortable', description: 'Bon hôtel, sorties sans compter' },
];

const RACCOURCIS = [20_000, 40_000, 60_000, 100_000];

export function StepBudget() {
  const { budgetMode, budgetPerPersonCents, comfortLevel, durationDays, patch } = useTripDraft();

  const parJour =
    budgetPerPersonCents !== null && durationDays > 0
      ? Math.round(budgetPerPersonCents / durationDays)
      : null;

  return (
    <div className="space-y-5">
      <div className="space-y-2.5" role="radiogroup" aria-label="Comment voyez-vous le budget ?">
        {MODES.map(({ value, label, description, icon: Icon }) => (
          <OptionCard
            key={value}
            selected={budgetMode === value}
            onSelect={() =>
              patch({
                budgetMode: value,
                ...(value === 'cheapest' ? { comfortLevel: 'budget' as const } : {}),
                ...(value === 'comfortable' ? { comfortLevel: 'comfort' as const } : {}),
              })
            }
            icon={<Icon className="size-5" aria-hidden />}
            title={label}
            description={description}
          />
        ))}
      </div>

      {budgetMode !== 'cheapest' && (
        <div className="animate-rise space-y-3">
          <Field
            label="Budget par personne, tout compris"
            hint={
              parJour !== null
                ? `Environ ${formatCents(parJour, 'EUR', { hideCentimes: true })} par jour, transport inclus.`
                : 'Transport, hébergement, nourriture et activités compris.'
            }
          >
            <MoneyInput
              label="Budget par personne"
              placeholder="400"
              entier
              value={budgetPerPersonCents === null ? '' : String(budgetPerPersonCents / 100)}
              onChange={(valeur) =>
                patch({
                  budgetPerPersonCents: valeur === '' ? null : parseAmountToCents(valeur),
                })
              }
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {RACCOURCIS.map((cents) => (
              <Chip
                key={cents}
                selected={budgetPerPersonCents === cents}
                onClick={() => patch({ budgetPerPersonCents: cents })}
              >
                {formatCents(cents, 'EUR', { hideCentimes: true })}
              </Chip>
            ))}
          </div>

          <p className="text-muted text-xs leading-relaxed">
            Chaque participant pourra indiquer son propre budget après avoir rejoint le voyage.
            Tripora retiendra toujours le plus serré du groupe : personne ne doit se retrouver
            embarqué dans un voyage qu’il ne peut pas payer.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BedDouble className="size-4" aria-hidden />
          Niveau de confort
        </p>
        <div className="space-y-2" role="radiogroup" aria-label="Niveau de confort">
          {COMFORTS.map(({ value, label, description }) => (
            <OptionCard
              key={value}
              compact
              selected={comfortLevel === value}
              onSelect={() => patch({ comfortLevel: value })}
              title={label}
              description={description}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
