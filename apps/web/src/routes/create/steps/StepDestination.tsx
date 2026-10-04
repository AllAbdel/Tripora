import { useEffect, useMemo, useState } from 'react';
import { Globe2, Loader2, Search, Sparkles, Target } from 'lucide-react';
import { findDestination, searchDestinations, type Destination } from '@tripora/core';
import { OptionCard } from '@/components/ui/OptionCard';
import { Chip } from '@/components/ui/Chip';
import { TextInput } from '@/components/ui/Field';
import { chercherVilles, retenirVille } from '@/lib/geocode';
import { useTripDraft } from '@/stores/tripDraft';
import { Drapeau } from '@/components/Drapeau';

/** Laisse finir de taper avant d'appeler : sinon c'est un appel par lettre. */
const ATTENTE_MS = 350;

export function StepDestination() {
  const { destinationMode, destinationIds, patch, toggleDestination } = useTripDraft();
  const [query, setQuery] = useState('');
  // Le résultat porte le terme qui l'a produit : c'est ce qui permet de savoir
  // qu'une recherche est en cours sans avoir à l'annoncer depuis l'effet.
  const [resultat, setResultat] = useState<{ terme: string; villes: Destination[] }>({
    terme: '',
    villes: [],
  });

  const terme = query.trim();
  const actif = terme.length >= 3;
  const catalogue = useMemo(() => searchDestinations(query, 30), [query]);

  useEffect(() => {
    if (!actif) return;
    let vivant = true;
    const minuteur = setTimeout(() => {
      void chercherVilles(terme).then((trouvees) => {
        if (vivant) setResultat({ terme, villes: trouvees });
      });
    }, ATTENTE_MS);

    return () => {
      vivant = false;
      clearTimeout(minuteur);
    };
  }, [terme, actif]);

  const cherche = actif && resultat.terme !== terme;

  // Le catalogue a déjà répondu pour ces villes-là : les répéter plus bas
  // ferait douter que ce soit la même.
  const villes = useMemo(() => {
    if (!actif || resultat.terme !== terme) return [];
    const connues = new Set(catalogue.map((entree) => entree.id));
    return resultat.villes.filter(
      (ville) =>
        !connues.has(ville.id) &&
        !catalogue.some(
          (entree) =>
            entree.name.localeCompare(ville.name, 'fr', { sensitivity: 'base' }) === 0,
        ),
    );
  }, [actif, resultat, terme, catalogue]);

  function choisir(destination: Destination) {
    const ajout = !destinationIds.includes(destination.id);
    toggleDestination(destination.id);
    // On ne retient que ce qui est vraiment choisi : parcourir des résultats
    // n'a pas à remplir le catalogue de tout le monde.
    if (ajout && destination.discovered) void retenirVille(destination);
  }

  const choisies = destinationIds
    .map((id) => findDestination(id))
    .filter((entree): entree is Destination => entree !== undefined);

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
          description="Cherchez n’importe quelle ville du monde. Un voyage peut en enchaîner plusieurs."
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
              placeholder="Chercher n’importe quelle ville"
              aria-label="Chercher une destination"
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

          {choisies.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-muted text-sm">
                {choisies.length === 1
                  ? '1 destination choisie'
                  : `${choisies.length} destinations choisies`}
              </p>
              <div className="flex flex-wrap gap-2">
                {choisies.map((destination) => (
                  <Chip
                    key={destination.id}
                    selected
                    onClick={() => toggleDestination(destination.id)}
                  >
                    {destination.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {catalogue.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {catalogue.map((destination) => (
                <Chip
                  key={destination.id}
                  selected={destinationIds.includes(destination.id)}
                  onClick={() => choisir(destination)}
                >
                  {destination.name}
                </Chip>
              ))}
            </div>
          )}

          {villes.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-muted flex items-center gap-1.5 text-xs">
                <Globe2 className="size-3.5" aria-hidden />
                Trouvées sur la carte du monde
              </p>
              <div className="flex flex-wrap gap-2">
                {villes.map((ville) => (
                  <Chip
                    key={ville.id}
                    selected={destinationIds.includes(ville.id)}
                    onClick={() => choisir(ville)}
                  >
                    <Drapeau code={ville.countryCode} className="mr-1.5" />
                    {ville.name}
                    {ville.country && (
                      <span className="text-muted ml-1.5 text-xs">{ville.country}</span>
                    )}
                  </Chip>
                ))}
              </div>
              <p className="text-muted text-xs leading-relaxed">
                Tripora en tirera les lieux réels et l’itinéraire. Il ne la classera pas
                face aux autres : ces villes-là n’ont pas de notes, et en inventer
                fausserait votre vote.
              </p>
            </div>
          )}

          {!cherche && actif && catalogue.length === 0 && villes.length === 0 && (
            <p className="text-muted py-6 text-center text-sm">
              Aucune ville à ce nom. Vérifiez l’orthographe, ou laissez Tripora proposer.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
