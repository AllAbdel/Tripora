import { Link } from 'react-router';
import { cn } from '@/lib/cn';
import { signaler } from '@/lib/feedback';
import { Pastille } from '@/components/Pastille';

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
  estOrganisateur,
  candidaturesEnAttente,
  nombreDActivites,
}: {
  tripId: string;
  destinationVerrouillee: boolean;
  collaborationActive: boolean;
  /** Ce qu'il manque encore au groupe, en une ligne. */
  attente: string;
  /** Vrai quand l'encart d'applications de l'aperçu tient déjà ce rôle. */
  destinationConnue: boolean;
  estOrganisateur: boolean;
  /** Combien de gens attendent une réponse. Zéro quand le voyage n'est pas ouvert. */
  candidaturesEnAttente: number;
  /** Ce que le carnet d'activités connaît de la destination. Zéro : pas de case. */
  nombreDActivites: number;
}) {
  const aDesActivites = nombreDActivites > 0;
  const cases = [
    collaborationActive && {
      to: `/voyages/${tripId}/participants`,
      pastille: 'participants' as const,
      titre: 'Participants',
      detail: attente,
      accent: false,
    },
    // « À faire » avant l'itinéraire : on choisit ce qu'on veut voir, puis on
    // le range dans les journées. L'ordre inverse demandait de savoir quoi
    // mettre dans un créneau avant d'avoir vu ce qui existait.
    destinationVerrouillee &&
      aDesActivites && {
        to: `/voyages/${tripId}/a-faire`,
        pastille: 'meteo' as const,
        titre: 'À faire',
        detail: `${nombreDActivites} idées sur place`,
        accent: false,
      },
    destinationVerrouillee && {
      to: `/voyages/${tripId}/itineraire`,
      pastille: 'itineraire' as const,
      titre: 'Itinéraire',
      detail: 'Jour par jour',
      accent: true,
    },
    {
      to: `/voyages/${tripId}/discussion`,
      pastille: 'discussion' as const,
      titre: 'Discussion',
      detail: 'Liens et épingles',
      accent: false,
    },
    {
      to: `/voyages/${tripId}/carte`,
      pastille: 'carte' as const,
      titre: 'Carte',
      detail: destinationVerrouillee ? 'Le trajet et les lieux' : 'Les villes en lice',
      accent: false,
    },
    {
      to: `/voyages/${tripId}/budget`,
      pastille: 'depenses' as const,
      titre: 'Dépenses',
      detail: 'Qui doit quoi',
      accent: false,
    },
    destinationVerrouillee && {
      to: `/voyages/${tripId}/valise`,
      pastille: 'valise' as const,
      titre: 'Ma valise',
      detail: 'Selon le climat',
      accent: false,
    },
    {
      to: `/voyages/${tripId}/recapitulatif`,
      pastille: 'recapitulatif' as const,
      titre: 'Récapitulatif',
      detail: 'PDF et partage',
      accent: false,
    },
    // Ouvrir son voyage à des inconnus n'a de sens qu'une fois la destination
    // arrêtée : c'est elle, avec le point de départ, qui permet de se trouver.
    destinationVerrouillee && {
      to: estOrganisateur ? `/voyages/${tripId}/candidatures` : `/voyages/${tripId}/ouverts`,
      pastille: 'ouvert' as const,
      titre: estOrganisateur ? 'Trip ouvert' : 'Partir avec d’autres',
      detail:
        candidaturesEnAttente > 0 ?
          `${candidaturesEnAttente} candidature${candidaturesEnAttente > 1 ? 's' : ''} à lire`
        : estOrganisateur ? 'Ouvrir à des inconnus'
        : 'Rejoindre un groupe',
      // La seule case qui peut réclamer quelque chose : quelqu'un attend une
      // réponse, et c'est plus pressant que le reste de la grille.
      accent: candidaturesEnAttente > 0,
    },
    !destinationConnue && {
      to: `/voyages/${tripId}/applications`,
      pastille: 'applications' as const,
      titre: 'Applications',
      detail: 'À installer avant',
      accent: false,
    },
  ].filter((entree): entree is Exclude<typeof entree, false> => entree !== false);

  return (
    <div className="animate-cascade grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {cases.map(({ to, pastille, titre, detail, accent }) => (
        <Link
          key={to}
          to={to}
          onClick={() => signaler('tape')}
          className={cn(
            'pressable surface-raised flex min-h-24 flex-col justify-between gap-2 rounded-2xl border p-3.5',
            'shadow-[var(--shadow-card)]',
            accent
              ? 'border-lagoon-500 bg-lagoon-500/5'
              : 'border-[color:var(--border-subtle)]',
          )}
        >
          <Pastille nom={pastille} taille="sm" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{titre}</span>
            <span className="text-muted block truncate text-xs">{detail}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
