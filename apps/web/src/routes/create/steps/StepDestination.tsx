import { useMemo, useState } from 'react';
import { Search, Sparkles, Target } from 'lucide-react';
import { DESTINATIONS } from '@tripora/core';
import { OptionCard } from '@/components/ui/OptionCard';
import { Chip } from '@/components/ui/Chip';
import { TextInput } from '@/components/ui/Field';
import { useTripDraft } from '@/stores/tripDraft';

export function StepDestination() {
  const { destinationMode, destinationIds, patch, toggleDestination } = useTripDraft();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const needle = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const pool = needle
      ? DESTINATIONS.filter((destination) =>
          `${destination.name} ${destination.country}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .includes(needle),
        )
      : DESTINATIONS;
    return [...pool].sort((a, b) => a.name.localeCompare(b.name, 'fr')).slice(0, 30);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="space-y-2.5" role="radiogroup" aria-label="Destination">
        <OptionCard
          selected={destinationMode === 'suggest'}
          onSelect={() => patch({ destinationMode: 'suggest' })}
          icon={<Sparkles className="size-5" aria-hidden />}
          title="Surprends-nous"
          description="Tripora compare les destinations selon vos budgets et vos envies, puis vous votez."
        />
        <OptionCard
          selected={destinationMode === 'fixed'}
          onSelect={() => patch({ destinationMode: 'fixed' })}
          icon={<Target className="size-5" aria-hidden />}
          title="On sait déjà où aller"
          description="Choisissez une ou plusieurs villes. Un voyage peut en enchaîner plusieurs."
        />
      </div>

      {destinationMode === 'fixed' && (
        <div className="animate-rise space-y-3">
          <div className="relative">
            <Search
              className="text-muted pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
              aria-hidden
            />
            <TextInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Chercher une ville ou un pays"
              aria-label="Chercher une destination"
              autoComplete="off"
              className="pl-11"
            />
          </div>

          {destinationIds.length > 0 && (
            <p className="text-muted text-sm">
              {destinationIds.length === 1
                ? '1 destination choisie'
                : `${destinationIds.length} destinations choisies`}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {results.map((destination) => (
              <Chip
                key={destination.id}
                selected={destinationIds.includes(destination.id)}
                onClick={() => toggleDestination(destination.id)}
              >
                {destination.name}
              </Chip>
            ))}
          </div>

          {results.length === 0 && (
            <p className="text-muted py-6 text-center text-sm">
              Rien à ce nom pour l’instant. Le catalogue s’étoffera, et vous pouvez toujours
              laisser Tripora proposer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
