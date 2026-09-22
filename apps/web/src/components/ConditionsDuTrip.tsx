import { CalendarRange, Languages, Users, Wallet, BedDouble, Gauge } from 'lucide-react';
import { formatCents } from '@tripora/core';
import { placesRestantes, type Mixite, type Rythme, type TripOuvert } from '@/lib/tripsOuverts';
import { cn } from '@/lib/cn';

/**
 * Les conditions d'un trip ouvert, dites en clair.
 *
 * C'est la pièce centrale de la fonctionnalité, et la raison pour laquelle
 * elle a été demandée : **savoir dans quoi on s'embarque avant d'y être**.
 * Elle est donc volontairement bavarde là où le reste de l'application est
 * économe — on ne devine pas une règle de mixité à une icône.
 *
 * Aucune condition n'est cachée derrière un « voir plus ». Si l'organisateur a
 * réservé son voyage aux femmes, a fixé une tranche d'âge et compte partager
 * une chambre, les trois se lisent d'un coup, avant le bouton.
 */

const MIXITE: Record<Mixite, { texte: string; ton: string }> = {
  femmes: {
    texte: 'Réservé aux femmes',
    ton: 'bg-brand-500/12 text-brand-700 dark:text-brand-200',
  },
  hommes: {
    texte: 'Réservé aux hommes',
    ton: 'bg-brand-500/12 text-brand-700 dark:text-brand-200',
  },
  mixte: {
    texte: 'Groupe mixte',
    ton: 'bg-[color:var(--surface-muted)] text-[color:var(--text-strong)]',
  },
};

const RYTHME: Record<Rythme, string> = {
  tranquille: 'Rythme tranquille',
  equilibre: 'Rythme équilibré',
  intense: 'Rythme intense',
};

/** Les noms de langues, pour ne pas afficher un code à deux lettres. */
const LANGUES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  it: 'italien',
  de: 'allemand',
  pt: 'portugais',
  tr: 'turc',
  ar: 'arabe',
  ru: 'russe',
  zh: 'chinois',
  ja: 'japonais',
  ko: 'coréen',
  nl: 'néerlandais',
  pl: 'polonais',
};

function Ligne({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span aria-hidden className="text-muted mt-0.5 shrink-0">
        {icone}
      </span>
      <span>{children}</span>
    </li>
  );
}

export function ConditionsDuTrip({ trip }: { trip: TripOuvert }) {
  const places = placesRestantes(trip);

  return (
    <div className="space-y-4">
      <p className={cn('etiquette inline-block rounded-md px-2.5 py-1', MIXITE[trip.mixite].ton)}>
        {MIXITE[trip.mixite].texte}
      </p>

      <ul className="space-y-2.5">
        <Ligne icone={<Users className="size-4" />}>
          <span className="chiffres font-semibold">{places.total}</span>{' '}
          {places.total > 1 ? 'places libres' : 'place libre'} sur{' '}
          <span className="chiffres">{trip.placesMax}</span>
          {/* Les quotas se disent explicitement : une place « libre » qui ne
              l'est pas pour vous est le genre de détail qu'on découvre au
              mauvais moment. */}
          {places.pourLesFemmes !== null && (
            <span className="text-muted">
              {' '}
              — dont <span className="chiffres">{places.pourLesFemmes}</span> réservée
              {places.pourLesFemmes > 1 ? 's' : ''} aux femmes
            </span>
          )}
          {places.pourLesHommes !== null && (
            <span className="text-muted">
              {' '}
              — dont <span className="chiffres">{places.pourLesHommes}</span> réservée
              {places.pourLesHommes > 1 ? 's' : ''} aux hommes
            </span>
          )}
        </Ligne>

        {(trip.ageMin !== null || trip.ageMax !== null) && (
          <Ligne icone={<CalendarRange className="size-4" />}>
            {trip.ageMin !== null && trip.ageMax !== null ?
              <>
                De <span className="chiffres">{trip.ageMin}</span> à{' '}
                <span className="chiffres">{trip.ageMax}</span> ans
              </>
            : trip.ageMin !== null ?
              <>
                À partir de <span className="chiffres">{trip.ageMin}</span> ans
              </>
            : <>
                Jusqu’à <span className="chiffres">{trip.ageMax}</span> ans
              </>
            }
          </Ligne>
        )}

        <Ligne icone={<Gauge className="size-4" />}>{RYTHME[trip.rythme]}</Ligne>

        {trip.langues.length > 0 && (
          <Ligne icone={<Languages className="size-4" />}>
            On y parle {trip.langues.map((code) => LANGUES[code] ?? code).join(', ')}
          </Ligne>
        )}

        <Ligne icone={<BedDouble className="size-4" />}>
          {trip.hebergementPartage ?
            'Hébergement partagé — chambre ou appartement en commun'
          : 'Chacun son hébergement'}
        </Ligne>

        {trip.budgetParPersonneCents !== null && (
          <Ligne icone={<Wallet className="size-4" />}>
            Budget visé :{' '}
            <span className="chiffres font-semibold">
              {formatCents(trip.budgetParPersonneCents, trip.devise)}
            </span>{' '}
            par personne
          </Ligne>
        )}
      </ul>

      <p className="text-muted text-xs">
        {trip.validation === 'auto' ?
          'L’organisateur accepte automatiquement toute personne qui remplit les conditions.'
        : 'L’organisateur lit chaque candidature et décide lui-même.'}
      </p>
    </div>
  );
}
