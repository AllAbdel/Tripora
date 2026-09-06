import { useMemo, useState } from 'react';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { searchOrigins, ORIGINS, haversineKm, type Place } from '@tripora/core';
import { TextInput } from '@/components/ui/Field';
import { OptionCard } from '@/components/ui/OptionCard';
import { Button } from '@/components/ui/Button';
import { Banner } from '@/components/ui/Banner';
import { useTripDraft } from '@/stores/tripDraft';

export function StepOrigin() {
  const { origin, patch } = useTripDraft();
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const results = useMemo(() => searchOrigins(query, 8), [query]);

  /**
   * Position de l'appareil : gratuite et sans clé. Faute de géocodage inverse à
   * ce stade, on rattache la position à la ville connue la plus proche plutôt
   * que d'afficher des coordonnées brutes.
   */
  function useMyPosition() {
    if (!navigator.geolocation) {
      setLocationError('Cet appareil ne partage pas sa position.');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude };
        const nearest = [...ORIGINS].sort(
          (a, b) => haversineKm(here, a) - haversineKm(here, b),
        )[0];
        if (nearest) patch({ origin: nearest });
        setLocating(false);
      },
      () => {
        setLocationError('Position refusée ou indisponible. Choisissez une ville.');
        setLocating(false);
      },
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
          aria-hidden
        />
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chercher une ville de départ"
          aria-label="Chercher une ville de départ"
          autoComplete="off"
          className="pl-11"
        />
      </div>

      <Button
        variant="secondary"
        block
        icon={<LocateFixed className="size-4" aria-hidden />}
        loading={locating}
        onClick={useMyPosition}
      >
        Utiliser ma position
      </Button>

      {locationError && <Banner tone="warning">{locationError}</Banner>}

      <div className="space-y-2" role="radiogroup" aria-label="Ville de départ">
        {origin && !results.some((place) => place.name === origin.name) && (
          <OptionCard
            compact
            selected
            onSelect={() => undefined}
            icon={<MapPin className="size-4" aria-hidden />}
            title={origin.name}
            description={describe(origin)}
          />
        )}
        {results.map((place) => (
          <OptionCard
            key={`${place.name}-${place.lat}`}
            compact
            selected={origin?.name === place.name}
            onSelect={() => patch({ origin: place })}
            icon={<MapPin className="size-4" aria-hidden />}
            title={place.name}
            description={describe(place)}
          />
        ))}
        {results.length === 0 && (
          <p className="text-muted px-1 py-6 text-center text-sm">
            Aucune ville ne correspond. D’autres villes s’ajouteront quand la recherche
            d’adresses sera branchée.
          </p>
        )}
      </div>
    </div>
  );
}

function describe(place: Place): string {
  const airports = place.iata?.slice(0, 2).join(', ');
  return [place.country, airports].filter(Boolean).join(' · ');
}
