import { useEffect, useMemo, useState } from 'react';
import { Globe2, Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import {
  haversineKm,
  nearestAirports,
  ORIGINS,
  searchOrigins,
  type AeroportsProches,
  type Place,
} from '@tripora/core';
import { chercherVilles } from '@/lib/geocode';
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

  const terme = query.trim();
  const actif = terme.length >= 3;
  // Comme pour les destinations : le résultat porte le terme qui l'a produit,
  // ce qui évite d'annoncer une recherche depuis l'effet.
  const [trouvees, setTrouvees] = useState<{ terme: string; villes: VilleAilleurs[] }>({
    terme: '',
    villes: [],
  });

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    const minuteur = setTimeout(() => {
      void chercherVilles(terme).then((villes) => {
        if (!vivant) return;
        setTrouvees({
          terme,
          // Une ville trouvée n'a pas de code IATA. Sans lui, aucun prix de vol
          // n'est relevé et tout le classement retombe sur des estimations : on
          // la rattache donc aux aéroports qui la desservent vraiment.
          villes: villes.map((ville) => {
            const desserte = nearestAirports(ville);
            return {
              place: {
                name: ville.name,
                lat: ville.lat,
                lng: ville.lng,
                ...(ville.country ? { country: ville.country } : {}),
                ...(desserte ? { iata: desserte.iata } : {}),
              },
              ...(desserte ? { desserte } : {}),
            };
          }),
        });
      });
    }, 350);
    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [terme, actif]);

  const cherche = actif && trouvees.terme !== terme;
  const ailleurs = useMemo(() => {
    if (!actif || trouvees.terme !== terme) return [];
    const connues = new Set(results.map((place) => place.name.toLocaleLowerCase('fr')));
    return trouvees.villes.filter(
      (ville) => !connues.has(ville.place.name.toLocaleLowerCase('fr')),
    );
  }, [actif, trouvees, terme, results]);

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
        {cherche && (
          <Loader2
            className="text-muted absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        )}
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
      </div>

      {ailleurs.length > 0 && (
        <div className="animate-rise space-y-2">
          <p className="text-muted flex items-center gap-1.5 text-xs">
            <Globe2 className="size-3.5" aria-hidden />
            Trouvées sur la carte du monde
          </p>
          <div className="space-y-2" role="radiogroup" aria-label="Autres villes de départ">
            {ailleurs.map(({ place, desserte }) => (
              <OptionCard
                key={`${place.name}-${place.lat}`}
                compact
                selected={origin?.name === place.name}
                onSelect={() => patch({ origin: place })}
                icon={<MapPin className="size-4" aria-hidden />}
                title={place.name}
                description={decrireAilleurs(place, desserte)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {!cherche && actif && results.length === 0 && ailleurs.length === 0 && (
          <p className="text-muted px-1 py-6 text-center text-sm">
            Aucune ville ne correspond. Vérifiez l’orthographe.
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

interface VilleAilleurs {
  place: Place;
  /** Ce qui la dessert, quand un aéroport est assez proche. */
  desserte?: AeroportsProches;
}

/**
 * Ce qu'on affiche sous une ville trouvée sur la carte du monde.
 *
 * Écrire « Colmar · BSL » laisserait croire que Colmar a un aéroport. On nomme
 * donc la ville de rattachement : « vols au départ de Bâle », qui se vérifie.
 * Et quand rien n'est assez près, on le dit plutôt que de le taire — sans
 * aéroport, aucun prix de vol ne sera relevé pour ce départ.
 */
function decrireAilleurs(place: Place, desserte: AeroportsProches | undefined): string {
  if (!desserte) {
    return [place.country, 'aucun aéroport à proximité'].filter(Boolean).join(' · ');
  }
  const codes = desserte.iata.slice(0, 2).join(', ');
  return [place.country, `vols au départ de ${desserte.ville} (${codes})`]
    .filter(Boolean)
    .join(' · ');
}
