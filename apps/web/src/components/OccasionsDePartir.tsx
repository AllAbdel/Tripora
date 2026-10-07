import { useMemo, useState } from 'react';
import { CalendarHeart } from 'lucide-react';
import {
  cePendant,
  dateDuJour,
  decaler,
  feriesConnus,
  localeActive,
  nomDeRegion,
  paysDeDepart,
  pontsEntre,
  regionProbable,
  regionsScolaires,
  vacancesAVenirDu,
  vacancesConnues,
  zoneProbable,
  type OccasionDePartir,
  type Place,
  type ZoneScolaire,
} from '@tripora/core';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/lib/cn';
import { useLangueActive } from '@/stores/langue';

const ZONES: readonly (ZoneScolaire | null)[] = ['A', 'B', 'C', null];
/** Jusqu'à ce nombre de régions, des puces ; au-delà, une liste déroulante. */
const PUCES_MAX = 4;

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
 * samedi. Les vacances scolaires : celles de la France (par zone) et d'une
 * quinzaine de pays européens (par Land, canton, communauté…), d'après
 * OpenHolidays. Ailleurs, seulement les jours fériés.
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
  const enFrance = pays === 'FR';
  const scolaire = vacancesConnues(pays);
  const regions = useMemo(() => (pays && !enFrance ? regionsScolaires(pays) : []), [pays, enFrance]);
  // La zone en France, la région ailleurs : devinée d'après la ville, modifiable.
  const devinee = useMemo(
    () => (!origin || !pays ? null : enFrance ? zoneProbable(origin) : regionProbable(pays, origin)),
    [origin, pays, enFrance],
  );
  // Un choix vaut pour son pays : changer de départ le fait oublier.
  const [choisie, setChoisie] = useState<{ pays: string | null; valeur: string | null } | null>(null);
  const zone = choisie && choisie.pays === pays ? choisie.valeur : devinee;
  const choisir = (valeur: string | null) => setChoisie({ pays, valeur });
  // Les noms des régions viennent des données, dans la langue de l'interface :
  // la mention qui les suit aussi.
  const deduite = langue === 'en' ? ' (inferred)' : ' (déduite)';
  const aujourdHui = dateDuJour();

  const occasions = useMemo(() => {
    if (!pays || (!feriesConnus(pays) && !scolaire)) return [];
    const horizon = decaler(aujourdHui, 300);
    const ponts = feriesConnus(pays) ? pontsEntre(decaler(aujourdHui, 7), horizon, pays) : [];
    if (!scolaire) return ponts.slice(0, 6);
    const vacances = vacancesAVenirDu(pays, aujourdHui, zone, 5).filter((periode) => periode.debut <= horizon);
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

      {enFrance && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Zone de vacances scolaires">
          <span className="text-muted text-xs">Vacances de la zone</span>
          {ZONES.map((valeur) => (
            <Chip
              key={valeur ?? 'aucune'}
              selected={zone === valeur}
              onClick={() => choisir(valeur)}
              className="min-h-9 px-3 text-xs"
            >
              {valeur ? `${valeur}${devinee === valeur && zone === devinee ? ' (déduite)' : ''}` : 'Toutes'}
            </Chip>
          ))}
        </div>
      )}

      {pays && regions.length > 0 && regions.length <= PUCES_MAX && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Région des vacances scolaires">
          <span className="text-muted text-xs">Vacances de la région</span>
          {[...regions.map((region) => region.code), null].map((valeur) => (
            <Chip
              key={valeur ?? 'aucune'}
              selected={zone === valeur}
              onClick={() => choisir(valeur)}
              className="min-h-9 px-3 text-xs"
            >
              {valeur
                ? `${nomDeRegion(pays, valeur, langue === 'en')}${devinee === valeur && zone === devinee ? deduite : ''}`
                : 'Toutes'}
            </Chip>
          ))}
        </div>
      )}

      {pays && regions.length > PUCES_MAX && (
        <div className="space-y-1">
          <label htmlFor="region-scolaire" className="text-muted block text-xs">
            Vacances de la région
          </label>
          <select
            id="region-scolaire"
            value={zone ?? ''}
            onChange={(evenement) => choisir(evenement.target.value || null)}
            className="surface-raised focus:border-brand-500 h-11 w-full rounded-[var(--radius-card)] border border-[color:var(--border-subtle)] px-3 text-[16px] outline-none sm:max-w-sm"
          >
            <option value="">Toutes les régions</option>
            {regions.map((region) => (
              <option key={region.code} value={region.code} translate="no">
                {`${langue === 'en' ? region.en : region.nom}${devinee === region.code ? deduite : ''}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {pays && !feriesConnus(pays) && !scolaire ? (
        <p className="text-muted text-xs">Tripora ne connaît pas encore les jours fériés de ce pays.</p>
      ) : !pays ? (
        <p className="text-muted text-xs">
          Ce départ est loin des villes que Tripora connaît : ses jours fériés ne peuvent pas être proposés.
        </p>
      ) : !scolaire ? (
        <p className="text-muted text-xs">
          Tripora ne connaît pas encore les vacances scolaires de ce pays : ici, seulement les jours fériés.
        </p>
      ) : (
        !enFrance && (
          // OpenHolidays est sous licence ODbL : la source se cite là où ses données se lisent.
          <p className="text-muted text-xs">Vacances scolaires : OpenHolidays.</p>
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

/**
 * « les vacances de la Toussaint », « le pont de l’Ascension », « la semaine
 * de février » : l'article suit le nom, et la majuscule du nom propre reste.
 */
function avecArticle(nom: string): string {
  const minuscule = (texte: string) => `${texte.charAt(0).toLowerCase()}${texte.slice(1)}`;
  if (/^Vacances/u.test(nom)) return `les ${minuscule(nom)}`;
  if (/^(Pont|Congé)/u.test(nom)) return `le ${minuscule(nom)}`;
  if (/^Semaine/u.test(nom)) return `la ${minuscule(nom)}`;
  return `« ${nom} »`;
}

/** « the autumn holidays », mais « the Christmas holidays » : seuls les noms communs perdent leur majuscule. */
function enAnglaisAvecArticle(nom: string): string {
  if (nom.startsWith('the ')) return nom;
  const commun = /^(Autumn|Winter|Spring|Summer|Semester|Mid-year|Half-term|Sports|Carnival)\b/u.test(nom);
  return `the ${commun ? `${nom.charAt(0).toLowerCase()}${nom.slice(1)}` : nom}`;
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
  const zone = !origin ? null : pays === 'FR' ? zoneProbable(origin) : regionProbable(pays, origin);
  const { vacances, feries } = cePendant(debut, fin, zone, pays);
  if (vacances.length === 0 && feries.length === 0) return null;
  const enAnglais = langue === 'en';
  const precision = !zone ? '' : pays === 'FR' ? ` (zone ${zone})` : ` (${nomDeRegion(pays, zone, enAnglais)})`;
  const noms = [
    ...new Set(
      vacances.map((periode) => (enAnglais ? enAnglaisAvecArticle(periode.en ?? VACANCES_EN[periode.nom] ?? periode.nom) : avecArticle(periode.nom))),
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
