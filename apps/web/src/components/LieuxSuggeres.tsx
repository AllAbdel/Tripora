import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Search } from 'lucide-react';
import {
  AXIS_LABELS_FR,
  foldedIncludes,
  groupWeights,
  rankPois,
  type Destination,
  type MemberPreference,
  type Poi,
} from '@tripora/core';
import { requeteDesLieux } from '@/lib/places';
import { chargerIllustrations, estAffichable } from '@/lib/illustrations';
import { TextInput } from '@/components/ui/Field';
import { cn } from '@/lib/cn';

/** Assez pour choisir, pas assez pour se noyer. Le champ de recherche fait le reste. */
const VISIBLES = 8;

/**
 * Les lieux réels de la destination, proposés au moment d'ajouter au programme.
 *
 * Jusqu'ici l'écran demandait « le nom du vrai lieu, celui que vous avez
 * trouvé » : il fallait aller le chercher ailleurs, puis le recopier. C'était
 * la conséquence assumée d'une règle du projet — ne jamais inventer un lieu.
 * Maintenant que Tripora en connaît de vrais, il peut les proposer sans
 * enfreindre la règle : ils viennent d'OpenStreetMap, pas d'un modèle.
 *
 * L'ordre suit les envies du groupe : cocher « culture » fait remonter les
 * musées. Le champ de saisie libre reste sous la liste, parce qu'aucun
 * catalogue ne connaît la crêperie que le cousin a recommandée.
 */
export function LieuxSuggeres({
  destination,
  members,
  onChoisir,
}: {
  destination: Destination;
  /** Sert à classer : les envies du groupe décident de ce qui remonte. */
  members: readonly MemberPreference[];
  onChoisir: (lieu: Poi) => void;
}) {
  const [recherche, setRecherche] = useState('');

  // Une destination, une réponse : partagée par tous les écrans et tous les
  // membres, et déjà mise en cache trente jours côté serveur.
  const lieux = useQuery(requeteDesLieux(destination));

  // Les photos, pour tous les lieux qu'un article décrit : carnet et
  // OpenStreetMap confondus. La clé suit le nombre de lieux, parce que la
  // liste s'allonge quand OpenStreetMap arrive après le carnet.
  const aIllustrer = useMemo(
    () => (lieux.data?.liste ?? []).filter((lieu) => lieu.wikipedia),
    [lieux.data],
  );
  const images = useQuery({
    queryKey: ['illustrations', 'lieux', destination.id, aIllustrer.length],
    queryFn: () => chargerIllustrations(aIllustrer),
    enabled: aIllustrer.length > 0,
    staleTime: 30 * 24 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
  });

  const envies = useMemo(() => groupWeights(members), [members]);

  const proposes = useMemo(() => {
    const tous = lieux.data?.liste ?? [];
    const filtres = recherche.trim()
      ? tous.filter((lieu) => foldedIncludes(`${lieu.name} ${lieu.label}`, recherche))
      : tous;
    return rankPois(filtres, envies).slice(0, VISIBLES);
  }, [lieux.data, recherche, envies]);

  if (lieux.isLoading) {
    return (
      <p className="text-muted flex items-center gap-2 py-2 text-sm">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Recherche des lieux de {destination.name}…
      </p>
    );
  }

  const total = lieux.data?.liste.length ?? 0;
  if (total === 0) {
    // Ni erreur ni écran vide : la saisie libre juste en dessous suffit.
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <TextInput
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder={`Chercher parmi ${total} lieux`}
          aria-label="Chercher un lieu"
          className="pl-9"
        />
      </div>

      {proposes.length === 0 ? (
        <p className="text-muted px-1 py-2 text-sm">
          Aucun lieu ne porte ce nom. Écrivez-le à la main juste en dessous.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {proposes.map((lieu) => {
            const photo = images.data?.[lieu.id];
            return (
              <li key={lieu.id}>
                <button
                  type="button"
                  onClick={() => onChoisir(lieu)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl p-2 text-left',
                    'hover:bg-brand-50 dark:hover:bg-ink-700/40 min-h-11',
                  )}
                >
                  {/* Seulement une photo dont on connaît la licence : l'image
                      brute de l'ancienne fonction serveur arrivait sans auteur,
                      et une réutilisation sans crédit est une infraction. */}
                  {photo && estAffichable(photo) ? (
                    <img
                      src={photo.url}
                      alt=""
                      loading="lazy"
                      className="size-11 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-300 grid size-11 shrink-0 place-items-center rounded-lg"
                    >
                      <MapPin className="size-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{lieu.name}</span>
                    <span className="text-muted block truncate text-xs">
                      {lieu.label} · {AXIS_LABELS_FR[lieu.axis]}
                    </span>
                    {lieu.extract && (
                      <span className="text-muted mt-0.5 line-clamp-2 block text-xs leading-snug">
                        {lieu.extract}
                      </span>
                    )}
                    {photo && estAffichable(photo) && (
                      <span className="text-muted mt-0.5 block truncate text-[0.625rem]">
                        Photo {photo.auteur ?? 'Wikimedia Commons'} · {photo.licence}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-muted px-1 text-xs">
        Lieux du carnet d’activités et d’OpenStreetMap, photos de Wikimedia Commons.
        Rien n’est inventé — et rien n’est noté non plus : à vous de choisir.
      </p>
    </div>
  );
}

/**
 * Les envies du groupe, moyennées.
 *
 * Pas de minimum ici, contrairement au choix de la destination : proposer une
 * liste n'impose rien à personne, chacun pioche ce qu'il veut. C'est au moment
 * de décider où l'on part que l'équité doit mordre.
 */
