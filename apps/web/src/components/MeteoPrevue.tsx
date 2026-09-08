import { useQuery } from '@tanstack/react-query';
import { CloudSun } from 'lucide-react';
import {
  dayVerdict,
  forecastForTrip,
  weatherIcon,
  weatherLabel,
  type DailyWeather,
  type Destination,
  type TripConstraints,
} from '@tripora/core';
import { chargerMeteo, cleMeteo } from '@/lib/weather';
import { Card, CardBody } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { Icone } from '@/components/Icone';

/**
 * La météo du séjour, quand elle est connue.
 *
 * Les normales climatiques du catalogue disent quel mois partir ; celles-ci
 * disent quoi mettre dans le sac. Elles n'existent qu'à seize jours, donc le
 * bloc n'apparaît qu'à l'approche du départ — et seulement si le groupe a
 * fixé des dates exactes. Le reste du temps la bande climatique fait le
 * travail, hors ligne et sans appel.
 *
 * Rien ne dépend de ce bloc : sans réseau, sans Supabase ou sans dates, il
 * disparaît et le voyage se prépare comme avant.
 */
export function MeteoPrevue({
  constraints,
  destination,
}: {
  constraints: TripConstraints;
  destination: Destination;
}) {
  const meteo = useQuery({
    queryKey: cleMeteo(destination.lat, destination.lng),
    queryFn: () => chargerMeteo(destination.lat, destination.lng),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    // Sans date de départ, la prévision n'a rien à recouper : on ne la
    // demande même pas.
    enabled: constraints.dateMode === 'exact' && Boolean(constraints.startDate),
  });

  if (meteo.data?.statut !== 'ok') return null;

  const jours = forecastForTrip(
    meteo.data.jours,
    constraints.startDate,
    constraints.durationDays,
  );
  if (jours.length === 0) return null;

  const aRentrer = jours.filter((jour) => dayVerdict(jour) === 'dedans');

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <CloudSun className="text-brand-500 size-4 shrink-0" aria-hidden />
          <h2 className="text-sm font-bold">La météo sur place</h2>
        </div>

        <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="list">
          {jours.map((jour) => (
            <li key={jour.date} className="shrink-0">
              <Jour jour={jour} />
            </li>
          ))}
        </ul>

        <p className="text-muted text-xs leading-relaxed">
          {aRentrer.length === 0
            ? 'Rien qui empêche de sortir sur la période annoncée.'
            : `${enFrancais(aRentrer)} : prévoyez de quoi faire à l’abri.`}{' '}
          Prévision Open-Meteo{meteo.data.perime ? ', dernière connue' : ''}, revue
          plusieurs fois par jour.
        </p>
      </CardBody>
    </Card>
  );
}

function Jour({ jour }: { jour: DailyWeather }) {
  const verdict = dayVerdict(jour);
  return (
    <div
      className={cn(
        'flex w-16 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2',
        verdict === 'dedans'
          ? 'border-gold-400/60 bg-gold-500/10'
          : 'border-[color:var(--border-subtle)]',
      )}
    >
      <span className="text-muted text-[10px] font-semibold uppercase">
        {jourCourt(jour.date)}
      </span>
      <Icone nom={weatherIcon(jour.code)} className="text-brand-500 size-5" />
      <span className="text-sm font-bold tabular-nums">{Math.round(jour.maxC)}°</span>
      <span className="text-muted text-[10px] tabular-nums">{Math.round(jour.minC)}°</span>
      <span className="sr-only">
        {longDate(jour.date)} : {weatherLabel(jour.code)}, {Math.round(jour.maxC)} degrés le
        jour, {Math.round(jour.minC)} la nuit
      </span>
    </div>
  );
}

const jourCourt = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');

const longDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

/** « Mardi et jeudi », plutôt qu'une liste à puces pour deux jours. */
function enFrancais(jours: readonly DailyWeather[]): string {
  const noms = jours.map((jour) =>
    new Date(`${jour.date}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' }),
  );
  const phrase =
    noms.length === 1
      ? noms[0]!
      : `${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]!}`;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}
