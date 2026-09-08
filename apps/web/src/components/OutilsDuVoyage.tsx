import { Link } from 'react-router';
import {
  CalendarDays,
  FileText,
  Luggage,
  Map as MapIcon,
  MessagesSquare,
  Smartphone,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { signaler } from '@/lib/feedback';

/**
 * Les écrans du voyage, en une grille compacte.
 *
 * Ils étaient six cartes pleine largeur empilées, chacune avec un titre et une
 * phrase d'explication. C'est très lisible la première fois et pénible les
 * vingt suivantes : deux écrans de défilement pour atteindre un menu qu'on
 * connaît déjà par cœur.
 *
 * En grille, l'ensemble tient dans un regard. La phrase d'explication devient
 * une ligne courte sous le titre, et disparaît là où elle n'apprenait rien.
 * L'information vraiment vivante — combien d'amis manquent à l'appel — reste,
 * parce que c'est la seule qui change d'un jour à l'autre.
 *
 * Une seule case est mise en avant à la fois : celle de l'étape en cours. Tout
 * mettre en avant revient à ne rien mettre en avant.
 */
export function OutilsDuVoyage({
  tripId,
  destinationVerrouillee,
  collaborationActive,
  attente,
  destinationConnue,
}: {
  tripId: string;
  destinationVerrouillee: boolean;
  collaborationActive: boolean;
  /** Ce qu'il manque encore au groupe, en une ligne. */
  attente: string;
  /** Vrai quand l'encart d'applications de l'aperçu tient déjà ce rôle. */
  destinationConnue: boolean;
}) {
  const cases = [
    collaborationActive && {
      to: `/voyages/${tripId}/participants`,
      icone: UserPlus,
      titre: 'Participants',
      detail: attente,
      accent: false,
    },
    destinationVerrouillee && {
      to: `/voyages/${tripId}/itineraire`,
      icone: CalendarDays,
      titre: 'Itinéraire',
      detail: 'Jour par jour',
      accent: true,
    },
    {
      to: `/voyages/${tripId}/discussion`,
      icone: MessagesSquare,
      titre: 'Discussion',
      detail: 'Liens et épingles',
      accent: false,
    },
    {
      to: `/voyages/${tripId}/carte`,
      icone: MapIcon,
      titre: 'Carte',
      detail: destinationVerrouillee ? 'Le trajet et les lieux' : 'Les villes en lice',
      accent: false,
    },
    {
      to: `/voyages/${tripId}/budget`,
      icone: Wallet,
      titre: 'Dépenses',
      detail: 'Qui doit quoi',
      accent: false,
    },
    destinationVerrouillee && {
      to: `/voyages/${tripId}/valise`,
      icone: Luggage,
      titre: 'Ma valise',
      detail: 'Selon le climat',
      accent: false,
    },
    {
      to: `/voyages/${tripId}/recapitulatif`,
      icone: FileText,
      titre: 'Récapitulatif',
      detail: 'PDF et partage',
      accent: false,
    },
    !destinationConnue && {
      to: `/voyages/${tripId}/applications`,
      icone: Smartphone,
      titre: 'Applications',
      detail: 'À installer avant',
      accent: false,
    },
  ].filter((entree): entree is Exclude<typeof entree, false> => entree !== false);

  return (
    <div className="animate-cascade grid grid-cols-2 gap-2.5">
      {cases.map(({ to, icone: Icone, titre, detail, accent }) => (
        <Link
          key={to}
          to={to}
          onClick={() => signaler('tape')}
          className={cn(
            'pressable surface-raised flex min-h-24 flex-col justify-between rounded-2xl border p-3.5',
            'shadow-[var(--shadow-card)]',
            accent
              ? 'border-lagoon-500 bg-lagoon-500/5'
              : 'border-[color:var(--border-subtle)]',
          )}
        >
          <Icone
            className={cn('size-5', accent ? 'text-lagoon-500' : 'text-brand-500')}
            aria-hidden
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{titre}</span>
            <span className="text-muted block truncate text-xs">{detail}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
