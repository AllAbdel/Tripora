import { useMemo, useState } from 'react';
import { CalendarHeart } from 'lucide-react';
import {
  cePendant,
  dateDuJour,
  decaler,
  feriesConnus,
  localeActive,
  paysDeDepart,
  pontsEntre,
  vacancesAVenir,
  zoneProbable,
  type OccasionDePartir,
  type Place,
  type ZoneScolaire,
} from '@tripora/core';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { useLangueActive } from '@/stores/langue';

const ZONES: readonly (ZoneScolaire | null)[] = ['A', 'B', 'C', null];

/** « jeu. 14 mai », « sam. 4 juil. 2027 » quand l'année change. */
function jour(iso: string, avecAnnee: boolean): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(localeActive(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(avecAnnee ? { year: 'numeric' } : {}),
  });
}

/**
 * Le pays dont on suit le calendrier : celui du départ. Sans départ choisi, la
 * France, comme avant qu'on sache d'où part le groupe.
 */
function paysDuCalendrier(origin: Place | null): string | null {
  return origin ? paysDeDepart(origin) : 'FR';
}

/**
 * Les bons moments pour partir, à portée de doigt.
 *
 * Les ponts de l'année — un 8 mai un vendredi, l'Ascension toujours un
 * jeudi — et les vacances scolaires de la zone du départ, devinée d'après la
 * ville et modifiable. Un appui remplit les dates : on n'a plus à ouvrir un
 * calendrier pour vérifier que le 14 juillet tombe un mardi.
 *
 * Le calendrier est celui du pays de départ : de Londres, le lundi de Pâques
 * et le dernier lundi d'août ; de Riyad, un week-end le vendredi et le
 * samedi. Les vacances scolaires, connues pour la France seulement,
 * n'apparaissent qu'au départ de la France.
 */
export function OccasionsDePartir({
  origin,
  onChoisir,
  familles = false,
}: {
  origin: Place | null;
  onChoisir: (occasion: OccasionDePartir) => void;
  /** Un groupe familial : les vacances scolaires passent devant les ponts. */
  familles?: boolean;
}) {
  const langue = useLangueActive();
  const pays = useMemo(() => paysDuCalendrier(origin), [origin]);
  const scolaire = pays === 'FR';
  const devinee = useMemo(() => (origin ? zoneProbable(origin) : null), [origin]);
  const [choisie, setChoisie] = useState<ZoneScolaire | null | undefined>(undefined);
  const zone = choisie === undefined ? devinee : choisie;
  const aujourdHui = dateDuJour();

  const occasions = useMemo(() => {
    if (!pays || !feriesConnus(pays)) return [];
    const horizon = decaler(aujourdHui, 300);
    const ponts = pontsEntre(decaler(aujourdHui, 7), horizon, pays);
    if (!scolaire) return ponts.slice(0, 6);
    const vacances = vacancesAVenir(aujourdHui, zone, 5).filter((periode) => periode.debut <= horizon);
    // Quatre ponts et deux périodes de vacances — l'inverse pour une famille,
    // qui ne part guère hors des vacances scolaires. Sans ce partage, les
    // ponts, plus nombreux, recouvraient tout. Puis l'ordre du calendrier.
    const choix = familles
      ? [...vacances.slice(0, 4), ...ponts.slice(0, 2)]
      : [...ponts.slice(0, 4), ...vacances.slice(0, 2)];
    return choix.sort((a, b) => a.debut.localeCompare(b.debut));
  }, [aujourdHui, pays, scolaire, zone, familles]);

  const anneeCourante = aujourdHui.slice(0, 4);

  return (
    <section className="space-y-3" aria-labelledby="titre-occasions">
      <div className="space-y-1">
        <h2 id="titre-occasions" className="flex items-center gap-2 text-sm font-semibold">
          <CalendarHeart className="text-brand-600 dark:text-brand-300 size-4" aria-hidden />
          Les bons moments pour partir
        </h2>
        {scolaire ? (
          <p className="text-muted text-xs">
            Ponts et vacances scolaires des mois qui viennent. Un appui remplit les dates.
          </p>
        ) : (
          <>
            <p className="text-muted text-xs">
              Les week-ends prolongés par un jour férié, dans les mois qui viennent. Un appui remplit les dates.
            </p>
            {origin?.country && (
              <p className="text-muted text-xs">
                Jours fériés du pays de départ : <span className="font-medium">{origin.country}</span>
              </p>
            )}
          </>
        )}
      </div>

      {scolaire && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Zone de vacances scolaires">
          <span className="text-muted text-xs">Vacances de la zone</span>
          {ZONES.map((valeur) => (
            <Chip
              key={valeur ?? 'aucune'}
              selected={zone === valeur}
              onClick={() => setChoisie(valeur)}
              className="min-h-9 px-3 text-xs"
            >
              {valeur ? `${valeur}${devinee === valeur && choisie === undefined ? ' (déduite)' : ''}` : 'Toutes'}
            </Chip>
          ))}
        </div>
      )}

      {pays && !feriesConnus(pays) ? (
        <p className="text-muted text-xs">Tripora ne connaît pas encore les jours fériés de ce pays.</p>
      ) : !pays ? (
        <p className="text-muted text-xs">
          Ce départ est loin des villes que Tripora connaît : ses jours fériés ne peuvent pas être proposés.
        </p>
      ) : (
        !scolaire && (
          <p className="text-muted text-xs">
            Les vacances scolaires ne sont connues que pour la France : ici, seulement les jours fériés.
          </p>
        )
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {occasions.map((occasion) => (
          <li key={`${occasion.nature}-${occasion.debut}-${occasion.nom}`}>
            <button
              type="button"
              onClick={() => onChoisir(occasion)}
              className={cn(
                'pressable surface-raised w-full rounded-[var(--radius-card)] border px-3.5 py-3 text-start',
                'border-[color:var(--border-subtle)] hover:border-brand-300',
              )}
            >
              <span className="block text-sm font-medium">
                {langue === 'en' && occasion.nomEn ? occasion.nomEn : occasion.nom}
              </span>
              <span className="text-muted block text-xs">
                {jour(occasion.debut, occasion.debut.slice(0, 4) !== anneeCourante)} →{' '}
                {jour(occasion.fin, occasion.fin.slice(0, 4) !== anneeCourante)}
                {occasion.finProvisoire ? ' (fin à confirmer)' : ''}
              </span>
              <span className="text-brand-700 dark:text-brand-200 mt-1 block text-xs font-semibold">
                {occasion.jours} jours
                {occasion.nature === 'pont'
                  ? occasion.aPoser === 0
                    ? ', sans poser de congé'
                    : `, ${occasion.aPoser} jour${occasion.aPoser > 1 ? 's' : ''} à poser`
                  : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Les vacances françaises, nommées en anglais. */
const VACANCES_EN: Readonly<Record<string, string>> = {
  'Vacances de la Toussaint': 'the All Saints’ holidays',
  'Vacances de Noël': 'the Christmas holidays',
  'Vacances d’hiver': 'the winter holidays',
  'Vacances de printemps': 'the spring holidays',
  'Pont de l’Ascension': 'the Ascension long weekend',
  'Vacances d’été': 'the summer holidays',
};

/**
 * Une phrase sur ce que des dates recoupent, ou rien.
 *
 * « Pendant les vacances de la Toussaint : plus de monde, des prix souvent
 * plus hauts. Le 11 novembre est férié. » Les fériés sont ceux du pays de
 * départ ; les vacances scolaires, celles de la France, au départ de la
 * France seulement. Chaque phrase est écrite d'un bloc, dans la langue de
 * l'interface : les noms viennent des données, la traduction au rendu ne
 * saurait pas les recomposer.
 */
export function CePendant({ debut, fin, origin }: { debut: string; fin: string; origin: Place | null }) {
  const langue = useLangueActive();
  const pays = paysDuCalendrier(origin);
  if (!pays || !feriesConnus(pays)) return null;
  const zone = origin && pays === 'FR' ? zoneProbable(origin) : null;
  const { vacances, feries } = cePendant(debut, fin, zone, pays);
  if (vacances.length === 0 && feries.length === 0) return null;
  const enAnglais = langue === 'en';
  const precision = zone ? ` (zone ${zone})` : '';
  // « les vacances de la Toussaint », « le pont de l’Ascension » : l'article
  // suit le nom, et la majuscule du nom propre reste.
  const noms = [
    ...new Set(
      vacances.map((periode) =>
        enAnglais
          ? (VACANCES_EN[periode.nom] ?? periode.nom)
          : periode.nom.startsWith('Pont')
            ? `le ${periode.nom.replace(/^Pont/u, 'pont')}`
            : `les ${periode.nom.replace(/^Vacances/u, 'vacances')}`,
      ),
    ),
  ];
  const phraseDesVacances =
    noms.length === 0
      ? null
      : enAnglais
        ? `During ${noms.join(' and ')}${precision}: busier, and prices often higher.`
        : `Pendant ${noms.join(' et ')}${precision} : plus de monde, et des prix souvent plus hauts.`;
  const liste = feries
    .map((ferie) => `${enAnglais ? ferie.en : ferie.nom} (${jour(ferie.date, false)})`)
    .join(', ');
  const phraseDesFeries =
    feries.length === 0
      ? null
      : enAnglais
        ? `${feries.length === 1 ? 'Public holiday' : 'Public holidays'}: ${liste}.`
        : `${feries.length === 1 ? 'Jour férié' : 'Jours fériés'} : ${liste}.`;
  return (
    <p role="status" className="text-muted text-xs leading-relaxed">
      {[phraseDesVacances, phraseDesFeries].filter(Boolean).join(' ')}
    </p>
  );
}
