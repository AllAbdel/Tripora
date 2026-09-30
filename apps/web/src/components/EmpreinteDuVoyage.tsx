import { useMemo } from 'react';
import { Leaf } from 'lucide-react';
import {
  empreinteDuTrajet,
  estimateTransportOptions,
  kgLisibles,
  partDeLObjectif,
  phraseDeComparaison,
  TRANSPORT_LABELS_FR,
  trajetEnFrance,
  type Destination,
  type Place,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';

/**
 * Ce que le trajet émet, selon la façon d'y aller.
 *
 * Posé sur un voyage dont la destination est décidée, au moment où l'on
 * réserve. Un seul chiffre par mode, par personne et aller-retour, et une
 * barre pour les comparer d'un coup d'œil — sans leçon de morale : c'est une
 * information, comme le prix ou la durée, pas un reproche.
 */
export function EmpreinteDuVoyage({
  depart,
  destination,
  participants,
}: {
  depart: Place;
  destination: Destination;
  participants: number;
}) {
  const empreintes = useMemo(() => {
    const enFrance = trajetEnFrance(depart, destination);
    return estimateTransportOptions(depart, destination, participants)
      .map((option) => empreinteDuTrajet(option.mode, depart, destination, { participants, enFrance }))
      .filter((empreinte) => empreinte !== null)
      .sort((a, b) => a.kg - b.kg);
  }, [depart, destination, participants]);

  if (empreintes.length === 0) return null;
  const plusLourde = Math.max(...empreintes.map((empreinte) => empreinte.kg), 1);
  const comparaison = phraseDeComparaison(empreintes);
  const avion = empreintes.find((empreinte) => empreinte.mode === 'plane');

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <Leaf className="text-lagoon-600 dark:text-lagoon-300 size-4" aria-hidden />
            L’empreinte du trajet
          </h2>
          <p className="text-muted text-xs">
            Par personne, aller et retour, depuis {depart.name}.
          </p>
        </div>

        <ul className="space-y-2.5">
          {empreintes.map((empreinte) => (
            <li key={empreinte.mode} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{TRANSPORT_LABELS_FR[empreinte.mode]}</span>
                <span className="chiffres font-semibold">{kgLisibles(empreinte.kg)} CO₂e</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--surface-muted)]" aria-hidden>
                <div
                  className={
                    empreinte.mode === 'plane'
                      ? 'bg-gold-500 h-full rounded-full'
                      : 'bg-lagoon-500 h-full rounded-full'
                  }
                  // Deux pour cent au moins : un train à 3 kg doit se voir.
                  style={{ width: `${Math.max(2, (empreinte.kg / plusLourde) * 100)}%` }}
                />
              </div>
              <p className="text-muted text-xs">{empreinte.source}</p>
            </li>
          ))}
        </ul>

        {comparaison && (
          <p className="text-lagoon-700 dark:text-lagoon-300 text-sm font-medium">{comparaison}</p>
        )}
        {avion && partDeLObjectif(avion.kg) >= 5 && (
          <p className="text-muted text-xs leading-relaxed">
            En avion, ce trajet représente {partDeLObjectif(avion.kg)} % des 2 tonnes par an et
            par personne que vise l’ADEME pour 2050.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
