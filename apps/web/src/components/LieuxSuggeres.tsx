import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin, Search } from 'lucide-react';
import {
  AXIS_LABELS_FR,
  foldedIncludes,
  rankPois,
  type Destination,
  type MemberPreference,
  type Poi,
} from '@tripora/core';
import { chargerLieux } from '@/lib/places';
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

  const lieux = useQuery({
    // Une destination, une réponse : partagée par tous les écrans et tous les
    // membres, et déjà mise en cache trente jours côté serveur.
    queryKey: ['lieux', destination.id],
    queryFn: () => chargerLieux(destination),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const envies = useMemo(() => moyenneDesEnvies(members), [members]);

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
          {proposes.map((lieu) => (
            <li key={lieu.id}>
              <button
                type="button"
                onClick={() => onChoisir(lieu)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl p-2 text-left',
                  'hover:bg-brand-50 dark:hover:bg-ink-700/40 min-h-11',
                )}
              >
                {lieu.imageUrl ? (
                  <img
                    src={lieu.imageUrl}
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
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted px-1 text-xs">
        Lieux d’OpenStreetMap, descriptions de Wikipédia. Rien n’est inventé — et
        rien n’est noté non plus : à vous de choisir.
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
function moyenneDesEnvies(members: readonly MemberPreference[]): Record<string, number> {
  if (members.length === 0) return {};
  const total: Record<string, number> = {};
  for (const membre of members) {
    for (const [axe, valeur] of Object.entries(membre.weights)) {
      total[axe] = (total[axe] ?? 0) + valeur;
    }
  }
  for (const axe of Object.keys(total)) total[axe] = total[axe]! / members.length;
  return total;
}
