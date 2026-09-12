import { Bus, Car, Info, Plane, Ship, Train } from 'lucide-react';
import {
  describeSource,
  detaillerTrajet,
  formatCents,
  TRANSPORT_LABELS_FR,
  type EtapeTrajet,
  type LieuNomme,
  type TransportEstimate,
} from '@tripora/core';

/**
 * Le trajet, étape par étape, et d'où vient son prix.
 *
 * Une ligne « Avion · 4 h · 180 € » ne dit ni par où l'on passe, ni qui vend à
 * ce tarif. Les deux manquent au moment de décider : un direct et un vol à
 * deux escales au même prix ne sont pas le même voyage, et un montant sans
 * source n'engage personne.
 *
 * Ce composant n'affiche que ce que le noyau sait vraiment. Là où l'itinéraire
 * réel n'est pas connu — c'est le cas du train, du bus, et de l'avion tant
 * qu'aucun prix n'a été relevé — il le dit au lieu de le deviner.
 */

const ICONES = { plane: Plane, train: Train, bus: Bus, car: Car, ferry: Ship } as const;

const NATURE = {
  vol: 'Vol',
  train: 'Train',
  bus: 'Bus',
  route: 'Route',
  transfert: 'Transfert',
} as const;

export function DetailDuTrajet({
  depart,
  arrivee,
  option,
}: {
  depart: LieuNomme;
  arrivee: LieuNomme;
  option: TransportEstimate;
}) {
  const Icone = ICONES[option.mode];
  const trajet = detaillerTrajet(depart, arrivee, option);
  const provenance = describeSource(option.price);

  return (
    <div className="rounded-xl border border-[color:var(--border-subtle)] p-3">
      <div className="flex items-baseline gap-2.5">
        <Icone className="text-muted size-4 shrink-0 translate-y-0.5" aria-hidden />
        <span className="font-medium">{TRANSPORT_LABELS_FR[option.mode]}</span>
        <span className="text-muted flex-1 text-xs">
          {duree(option.durationMin)} aller-retour
        </span>
        <span className="font-semibold tabular-nums">
          {formatCents(option.price.cents ?? 0, 'EUR', { hideCentimes: true })}
        </span>
      </div>

      <p className="text-muted mt-1 text-xs">
        {trajet.distanceKm.toLocaleString('fr-FR')} km à vol d’oiseau
        {trajet.escales === null
          ? ''
          : trajet.escales === 0
            ? ' · sans escale'
            : ` · ${trajet.escales} escale${trajet.escales > 1 ? 's' : ''}`}
      </p>

      <ol className="mt-2 space-y-1.5">
        {trajet.etapes.map((etape, index) => (
          <Etape key={`${etape.nature}-${index}`} etape={etape} />
        ))}
      </ol>

      <p className="text-muted mt-2 flex items-start gap-1.5 text-xs">
        <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>{trajet.precision}</span>
      </p>

      <p
        className={
          provenance.releve
            ? 'text-lagoon-700 dark:text-lagoon-300 mt-1.5 text-xs font-medium'
            : 'text-muted mt-1.5 text-xs'
        }
      >
        {provenance.long}
      </p>
    </div>
  );
}

/**
 * Une étape, avec sa pastille et son trait de liaison.
 *
 * Le trait n'est pas décoratif : c'est lui qui fait lire la suite comme un
 * parcours et non comme une liste de trois faits sans rapport.
 */
function Etape({ etape }: { etape: EtapeTrajet }) {
  return (
    <li className="flex gap-2.5 text-xs">
      <span className="relative flex w-2 shrink-0 justify-center" aria-hidden>
        <span className="bg-brand-500 mt-1.5 size-1.5 rounded-full" />
        <span className="absolute top-3.5 bottom-[-0.5rem] w-px bg-[color:var(--border-subtle)] last:hidden" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-medium">{NATURE[etape.nature]}</span>{' '}
        <span className="text-muted">
          {etape.depuis} → {etape.vers}
        </span>
      </span>
      <span className="text-muted shrink-0 tabular-nums">{duree(etape.dureeMin)}</span>
    </li>
  );
}

function duree(minutes: number): string {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (heures === 0) return `${reste} min`;
  return reste === 0 ? `${heures} h` : `${heures} h ${String(reste).padStart(2, '0')}`;
}
