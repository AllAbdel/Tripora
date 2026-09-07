import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  CloudRain,
  Crown,
  Loader2,
  Lock,
  Plane,
  Train,
  Bus,
  Car,
  Ship,
  Sparkles,
  Thermometer,
} from 'lucide-react';
import {
  climateFor,
  costLines,
  formatCents,
  freshnessLabel,
  TRANSPORT_LABELS_FR,
  type DestinationScore,
  type Destination,
  type TransportEstimate,
} from '@tripora/core';
import { Card, CardBody } from '@/components/ui/Card';
import { ClimateStrip } from '@/components/ClimateStrip';
import { ScoreRing } from '@/components/ScoreRing';
import { messageIA, rediger } from '@/lib/ai';
import { faitsPourExplication } from '@/lib/explication';
import { cn } from '@/lib/cn';

const TRANSPORT_ICONS = {
  plane: Plane,
  train: Train,
  bus: Bus,
  car: Car,
  ferry: Ship,
} as const;

export function ProposalCard({
  rank,
  destination,
  score,
  transport,
  month,
  participants,
  vote,
  choixDuGroupe = false,
  verrouillee = false,
}: {
  rank: number;
  destination: Destination;
  score: DestinationScore;
  transport: TransportEstimate[];
  /** Mois visé, quand le groupe en a fixé un : sert à situer le climat. */
  month?: number | undefined;
  /** Taille du groupe, transmise à l'explication rédigée. Aucun nom ne l'est. */
  participants: number;
  /** Barre de vote, absente quand on voyage seul. */
  vote?: ReactNode;
  /** Celle que les votes désignent, distincte de celle que le calcul classe en tête. */
  choixDuGroupe?: boolean;
  verrouillee?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const climat = month === undefined ? undefined : climateFor(destination.id, month);
  const [texte, setTexte] = useState<string | null>(null);
  const [redaction, setRedaction] = useState(false);

  /**
   * Explication rédigée, à la demande seulement.
   *
   * Jamais automatique : chaque carte qui se rédigerait toute seule brûlerait
   * six appels d'IA pour un écran que personne n'a demandé à lire. Et la note
   * est déjà expliquée facteur par facteur juste au-dessus — c'est le calcul
   * qui explique, l'IA ne fait que le mettre en phrases.
   */
  async function demanderTexte() {
    if (redaction) return;
    setRedaction(true);
    const etat = await rediger(
      faitsPourExplication(destination, score, month, participants),
    );
    setRedaction(false);
    setTexte(etat.statut === 'ok' && 'texte' in etat ? etat.texte : messageIA(etat));
  }
  const label = freshnessLabel({
    cents: score.cost.transportCents,
    source: score.cost.transportSource,
    ...(score.cost.transportFetchedAt ? { fetchedAt: score.cost.transportFetchedAt } : {}),
    ...(score.cost.transportProvider ? { provider: score.cost.transportProvider } : {}),
  });

  return (
    <Card
      className={cn(
        'animate-rise overflow-hidden',
        verrouillee && 'border-lagoon-500 ring-1 ring-lagoon-500',
        choixDuGroupe && !verrouillee && 'border-gold-500',
      )}
    >
      <CardBody className="space-y-3">
        {(verrouillee || choixDuGroupe) && (
          <p
            className={cn(
              'flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase',
              verrouillee ? 'text-lagoon-700 dark:text-lagoon-300' : 'text-gold-700 dark:text-gold-300',
            )}
          >
            {verrouillee ? (
              <>
                <Lock className="size-3.5" aria-hidden />
                Destination retenue
              </>
            ) : (
              <>
                <Crown className="size-3.5" aria-hidden />
                Le groupe préfère celle-ci
              </>
            )}
          </p>
        )}

        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="bg-brand-50 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200 mt-1 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold"
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{destination.name}</h3>
            <p className="text-muted text-sm">{destination.country}</p>
          </div>
          <ScoreRing score={score.total} />
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
          <p className="text-2xl font-bold tabular-nums">
            {formatCents(score.cost.totalCents, 'EUR', { hideCentimes: true })}
            <span className="text-muted ml-1.5 text-sm font-medium">par personne</span>
          </p>
          {climat && (
            <p className="text-muted flex items-center gap-2.5 text-xs font-medium">
              <span className="flex items-center gap-1">
                <Thermometer className="size-3.5" aria-hidden />
                <span className="tabular-nums">{Math.round(climat.avgHighC)} °C</span>
              </span>
              <span className="flex items-center gap-1">
                <CloudRain className="size-3.5" aria-hidden />
                <span className="tabular-nums">{climat.rainyDays} j</span>
              </span>
              <span className="sr-only">
                en journée et jours de pluie sur le mois, en moyenne
              </span>
            </p>
          )}
        </div>

        {/* Ce qui la distingue plutôt que ce qu'elle partage : six cartes qui
            disent « tient dans le budget, forte en gastronomie » ne donnent
            rien à décider. Le détail des facteurs est juste en dessous. */}
        <p className="text-sm leading-relaxed">{score.edge ?? score.summary}</p>

        {vote}

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="text-brand-600 dark:text-brand-300 flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold"
        >
          {open ? 'Masquer le détail' : 'Voir le détail du prix et de la note'}
          <ChevronDown
            className={cn('size-4 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </button>

        {open && (
          <div className="animate-rise space-y-4 border-t border-[color:var(--border-subtle)] pt-3">
            <section className="space-y-1.5">
              <h4 className="text-sm font-semibold">Ce que coûte le voyage</h4>
              <ul className="space-y-1 text-sm">
                {costLines(score.cost).map((line) => (
                  <li key={line.key} className="flex justify-between gap-4">
                    <span className="text-muted">{line.label}</span>
                    <span className="tabular-nums">
                      {formatCents(line.cents, 'EUR', { hideCentimes: true })}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-muted pt-1 text-xs">{label} · le reste est estimé.</p>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Comment la note est calculée</h4>
              <ul className="space-y-2">
                {score.factors.map((factor) => (
                  <li key={factor.key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-medium">{factor.label}</span>
                      <span className="text-muted tabular-nums">
                        {Math.round(factor.score)}/100
                        <span className="ml-1 text-xs">
                          · {Math.round(factor.weight * 100)} %
                        </span>
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-[color:var(--border-subtle)]"
                      aria-hidden
                    >
                      <div
                        className="bg-brand-500 h-full rounded-full transition-[width] duration-500"
                        style={{ width: `${Math.round(factor.score)}%` }}
                      />
                    </div>
                    <p className="text-muted text-xs">{factor.reason}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">En une phrase</h4>
              {texte ? (
                <p className="text-muted text-sm leading-relaxed">{texte}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void demanderTexte()}
                  disabled={redaction}
                  className="text-brand-600 dark:text-brand-300 flex min-h-11 items-center gap-2 text-sm font-semibold disabled:opacity-60"
                >
                  {redaction ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Sparkles className="size-4" aria-hidden />
                  )}
                  {redaction ? 'Rédaction…' : 'Résumer cette note en une phrase'}
                </button>
              )}
            </section>

            <section className="space-y-1.5">
              <h4 className="text-sm font-semibold">Quand y aller</h4>
              <ClimateStrip destinationId={destination.id} month={month} />
            </section>

            {transport.length > 0 && (
              <section className="space-y-1.5">
                <h4 className="text-sm font-semibold">Comment y aller</h4>
                <ul className="space-y-1.5 text-sm">
                  {transport.map((option) => {
                    const Icon = TRANSPORT_ICONS[option.mode];
                    return (
                      <li key={option.mode} className="flex items-center gap-2.5">
                        <Icon className="text-muted size-4 shrink-0" aria-hidden />
                        <span className="font-medium">{TRANSPORT_LABELS_FR[option.mode]}</span>
                        <span className="text-muted flex-1 text-xs">
                          {formatDuration(option.durationMin)}
                        </span>
                        <span className="tabular-nums">
                          {formatCents(option.price.cents ?? 0, 'EUR', { hideCentimes: true })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-muted pt-0.5 text-xs">
                  Durées aller-retour estimées, transferts compris.
                </p>
              </section>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}
