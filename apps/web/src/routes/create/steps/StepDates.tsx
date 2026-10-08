import { CalendarDays, CalendarRange, CalendarSearch, Sun } from 'lucide-react';
import { dateDuJour, type DateMode } from '@tripora/core';
import { OptionCard } from '@/components/ui/OptionCard';
import { Chip } from '@/components/ui/Chip';
import { Field, TextInput } from '@/components/ui/Field';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { CePendant, OccasionsDePartir } from '@/components/OccasionsDePartir';
import { MONTHS, useTripDraft } from '@/stores/tripDraft';

const MODES: { value: DateMode; label: string; description: string; icon: typeof Sun }[] = [
  {
    value: 'month',
    label: 'Un mois, sans plus de précision',
    description: 'Le plus souple, et souvent le moins cher.',
    icon: CalendarSearch,
  },
  {
    value: 'window',
    label: 'Entre deux dates',
    description: 'Tripora cherchera la période la moins chère dans cette fenêtre.',
    icon: CalendarRange,
  },
  {
    value: 'exact',
    label: 'Des dates précises',
    description: 'Vous savez déjà quand vous partez.',
    icon: CalendarDays,
  },
  {
    value: 'weekend',
    label: 'Un week-end',
    description: 'Du vendredi soir au dimanche.',
    icon: Sun,
  },
];

export function StepDates() {
  const draft = useTripDraft();
  const { dateMode, month, startDate, endDate, windowStart, windowEnd, durationDays, origin, groupType, patch } =
    draft;
  const today = dateDuJour();

  return (
    <div className="space-y-5">
      <div data-guide="quand" className="space-y-2.5" role="radiogroup" aria-label="Quand partez-vous ?">
        {MODES.map(({ value, label, description, icon: Icon }) => (
          <OptionCard
            key={value}
            selected={dateMode === value}
            onSelect={() =>
              patch({ dateMode: value, ...(value === 'weekend' ? { durationDays: 3 } : {}) })
            }
            icon={<Icon className="size-5" aria-hidden />}
            title={label}
            description={description}
          />
        ))}
      </div>

      {dateMode === 'month' && (
        <div data-guide="dates" className="animate-rise space-y-2">
          <p className="text-sm font-semibold">Quel mois ?</p>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((name, index) => (
              <Chip
                key={name}
                selected={month === index + 1}
                onClick={() => patch({ month: index + 1 })}
              >
                {name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {dateMode === 'window' && (
        <div data-guide="dates" className="animate-rise grid grid-cols-2 gap-3">
          <Field label="À partir du">
            <TextInput
              type="date"
              min={today}
              value={windowStart ?? ''}
              onChange={(event) => patch({ windowStart: event.target.value || null })}
            />
          </Field>
          <Field label="Jusqu’au">
            <TextInput
              type="date"
              min={windowStart ?? today}
              value={windowEnd ?? ''}
              onChange={(event) => patch({ windowEnd: event.target.value || null })}
            />
          </Field>
        </div>
      )}

      {dateMode === 'exact' && (
        <div data-guide="dates" className="animate-rise grid grid-cols-2 gap-3">
          <Field label="Départ">
            <TextInput
              type="date"
              min={today}
              value={startDate ?? ''}
              onChange={(event) => patch({ startDate: event.target.value || null })}
            />
          </Field>
          <Field label="Retour">
            <TextInput
              type="date"
              min={startDate ?? today}
              value={endDate ?? ''}
              onChange={(event) => {
                const value = event.target.value || null;
                const days =
                  value && startDate
                    ? Math.max(
                        1,
                        Math.round(
                          (Date.parse(value) - Date.parse(startDate)) / 86_400_000,
                        ) + 1,
                      )
                    : durationDays;
                patch({ endDate: value, durationDays: days });
              }}
            />
          </Field>
        </div>
      )}

      {dateMode === 'exact' && startDate && endDate && (
        <CePendant debut={startDate} fin={endDate} origin={origin} />
      )}
      {dateMode === 'window' && windowStart && windowEnd && (
        <CePendant debut={windowStart} fin={windowEnd} origin={origin} />
      )}

      {dateMode !== 'exact' && (
        <NumberStepper
          label="Durée du séjour"
          value={durationDays}
          min={1}
          max={30}
          suffix={durationDays > 1 ? 'jours' : 'jour'}
          onChange={(value) => patch({ durationDays: value })}
        />
      )}

      {/* Les ponts et les vacances : un appui, et les dates sont posées. Les
          grandes vacances ne se prennent pas en entier — elles deviennent une
          fenêtre, dans laquelle Tripora cherche la période la moins chère. */}
      <OccasionsDePartir
        origin={origin}
        familles={groupType === 'family'}
        onChoisir={(occasion) =>
          occasion.jours > 16
            ? patch({ dateMode: 'window', windowStart: occasion.debut, windowEnd: occasion.fin })
            : patch({
                dateMode: 'exact',
                startDate: occasion.debut,
                endDate: occasion.fin,
                durationDays: occasion.jours,
              })
        }
      />
    </div>
  );
}
