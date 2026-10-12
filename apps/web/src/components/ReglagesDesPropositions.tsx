import { useMemo, useState } from 'react';
import { Globe2, RefreshCw, RotateCcw } from 'lucide-react';
import {
  NOMS_DES_CONTINENTS,
  selectCandidates,
  type Continent,
  type TripConstraints,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChoixDesContinents } from '@/components/ChoixDesContinents';
import { aMettreDeCote } from '@/lib/autresIdees';
import type { VoteTally } from '@/lib/votes';

/**
 * Où chercher : les continents de « Surprends-nous », sur l'écran du voyage.
 *
 * C'est souvent devant une liste qui ne plaît pas qu'on se dit « et pourquoi
 * pas l'Asie ? » : l'organisateur peut donc changer ce choix après coup. Les
 * autres membres le voient sans pouvoir le changer — c'est la même décision
 * que la destination, et la base la réserve à l'organisateur.
 */
export function OuChercher({
  regions,
  estOrganisateur,
  onChange,
}: {
  regions: readonly Continent[];
  estOrganisateur: boolean;
  onChange: (regions: Continent[]) => void;
}) {
  if (!estOrganisateur) {
    if (regions.length === 0) return null;
    return (
      <p className="text-muted flex items-start gap-1.5 text-sm">
        <Globe2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          Tripora cherche seulement là : {regions.map((continent) => NOMS_DES_CONTINENTS[continent]).join(', ')}.
          L’organisateur peut changer ce choix.
        </span>
      </p>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-2.5">
        <p className="etiquette">Où chercher</p>
        <ChoixDesContinents valeur={regions} onChange={onChange} />
        <p className="text-muted text-xs leading-relaxed">
          {regions.length === 0
            ? 'Partout, Tripora reste à une distance raisonnable pour la durée du séjour.'
            : 'Tripora ne cherche que là, même loin. L’Amérique du Nord comprend l’Amérique centrale et les Caraïbes.'}
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * « D'autres idées » : le groupe n'aime aucune des destinations proposées.
 *
 * L'organisateur met de côté celles que personne n'a aimées, et le moteur en
 * étudie d'autres à leur place ; celles qui ont reçu un « J'aime » restent.
 * La liste vit sur le voyage : tout le groupe vote sur les mêmes destinations.
 * Rien n'est perdu : « Revoir les destinations mises de côté » les ramène.
 */
export function DAutresIdees({
  constraints,
  affichees,
  tallies,
  ecartees,
  estOrganisateur,
  enCours,
  onEcarter,
  onRevoir,
}: {
  constraints: TripConstraints;
  /** Les destinations affichées, dans l'ordre. */
  affichees: readonly string[];
  tallies: Readonly<Record<string, VoteTally>> | undefined;
  ecartees: readonly string[];
  estOrganisateur: boolean;
  enCours: boolean;
  onEcarter: (ids: string[]) => void;
  onRevoir: () => void;
}) {
  const partantes = useMemo(() => aMettreDeCote(affichees, tallies), [affichees, tallies]);
  // La nouvelle liste s'affiche plus haut : on le dit à qui ne la voit pas.
  const [annonce, setAnnonce] = useState('');

  // Reste-t-il au moins une destination jamais montrée ? Un calcul en mémoire,
  // sur le catalogue : on ne promet pas d'autres idées qui n'existent pas.
  const resteDesIdees = useMemo(
    () =>
      selectCandidates(constraints, { limit: 1, exclude: [...ecartees, ...affichees] }).length > 0,
    [constraints, ecartees, affichees],
  );

  if (!estOrganisateur) {
    return (
      <p className="text-muted px-1 text-sm leading-relaxed">
        Aucune ne vous tente ? Dites-le avec « Pas pour moi » : l’organisateur peut demander
        d’autres idées.
      </p>
    );
  }

  const possible = partantes.length > 0 && resteDesIdees;

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="font-semibold">Aucune ne vous tente ?</p>
        <p className="text-muted text-sm leading-relaxed">
          {!resteDesIdees
            ? 'Tripora a fait le tour de ce qui colle à vos critères. Élargissez les continents, le budget ou la période pour en voir d’autres.'
            : partantes.length === 0
              ? 'Chaque destination a reçu au moins un « J’aime » : il n’y a rien à remplacer.'
              : partantes.length === affichees.length
                ? 'Tripora met ces destinations de côté et en propose d’autres à leur place.'
                : 'Tripora met de côté celles que personne n’a aimées et en propose d’autres à leur place. Celles qui ont reçu un « J’aime » restent.'}
        </p>
        <Button
          variant="secondary"
          block
          disabled={!possible}
          loading={enCours}
          icon={<RefreshCw className="size-4" aria-hidden />}
          onClick={() => {
            onEcarter(partantes);
            setAnnonce('De nouvelles idées sont affichées en haut de la liste.');
          }}
        >
          D’autres idées
        </Button>
        <p role="status" className="sr-only">
          {annonce}
        </p>
        {ecartees.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onRevoir();
              setAnnonce('Les destinations mises de côté sont revenues dans la liste.');
            }}
            className="text-brand-600 dark:text-brand-300 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium underline"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {ecartees.length === 1
              ? 'Revoir la destination mise de côté'
              : `Revoir les ${ecartees.length} destinations mises de côté`}
          </button>
        )}
      </CardBody>
    </Card>
  );
}
