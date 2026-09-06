import { climateYear, type MonthlyClimate } from '@tripora/core';
import { cn } from '@/lib/cn';

const INITIALES = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Les douze mois d'une destination, d'un coup d'œil.
 *
 * Chaque barre monte avec la température de journée et se colore selon qu'on
 * peut y marcher sans y penser. Le mois visé est encadré. C'est la réponse
 * visuelle à « et si on partait plutôt en mai ? », sans avoir à relancer le
 * calcul : la réponse est déjà là, mesurée.
 */
export function ClimateStrip({
  destinationId,
  month,
  className,
}: {
  destinationId: string;
  month?: number | undefined;
  className?: string;
}) {
  const annee = climateYear(destinationId);
  if (annee.length !== 12) return null;

  const maxi = Math.max(...annee.map((mois) => mois.avgHighC));
  const mini = Math.min(...annee.map((mois) => mois.avgLowC));
  const amplitude = Math.max(1, maxi - mini);

  return (
    <div className={className}>
      <ul className="flex items-end gap-1" role="list">
        {annee.map((mois) => {
          const cible = mois.month === month;
          const hauteur = 24 + ((mois.avgHighC - mini) / amplitude) * 40;
          return (
            <li key={mois.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-muted text-[10px] leading-none tabular-nums">
                {Math.round(mois.avgHighC)}
              </span>
              <span
                className={cn(
                  'w-full rounded-sm',
                  couleur(mois),
                  cible &&
                    'ring-2 ring-[color:var(--text-strong)] ring-offset-1 ring-offset-[color:var(--surface-raised)]',
                )}
                style={{ height: `${Math.round(hauteur)}px` }}
                aria-hidden
              />
              <span
                className={cn(
                  'text-[10px] leading-none',
                  cible ? 'font-bold' : 'text-muted',
                )}
              >
                {INITIALES[mois.month - 1]}
              </span>
              <span className="sr-only">{decrire(mois)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-muted pt-2 text-xs">
        Maximum moyen de la journée, en degrés. Normales mesurées sur 2023-2025.
      </p>
    </div>
  );
}

/** Même lecture du confort que la note : ni trop frais, ni écrasant. */
function couleur(mois: MonthlyClimate): string {
  if (mois.avgHighC >= 33) return 'bg-red-500/80';
  if (mois.avgHighC >= 28) return 'bg-gold-500/80';
  if (mois.avgHighC >= 17) return 'bg-lagoon-500/80';
  if (mois.avgHighC >= 10) return 'bg-brand-400/70';
  return 'bg-brand-700/60';
}

function decrire(mois: MonthlyClimate): string {
  const pluie =
    mois.rainyDays === 0
      ? 'aucun jour de pluie'
      : `${mois.rainyDays} jour${mois.rainyDays > 1 ? 's' : ''} de pluie`;
  return `${NOMS[mois.month - 1]} : ${Math.round(mois.avgHighC)} °C en journée, ${Math.round(mois.avgLowC)} °C la nuit, ${pluie}`;
}

const NOMS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];
