import { useQuery } from '@tanstack/react-query';
import { MapPin, Pin } from 'lucide-react';
import { getDiscussion, type Epingle } from '@/lib/discussion';
import { cn } from '@/lib/cn';

/**
 * Les endroits que le groupe a retenus, au moment de remplir une journée.
 *
 * Un lieu épinglé dans la discussion est le seul de tout l'écran dont on sache
 * que quelqu'un le veut vraiment : il a été trouvé, partagé, discuté. Il passe
 * donc avant les suggestions d'OpenStreetMap, qui ne sont que pertinentes.
 *
 * Affiché même avant que la destination soit tranchée, contrairement aux lieux
 * suggérés : la conversation commence le premier jour, et ce qui en sort ne
 * doit pas attendre un vote pour être utilisable.
 *
 * Rien quand il n'y a rien : ni titre orphelin, ni encouragement à épingler.
 * La saisie libre juste en dessous suffit, et un bloc vide n'aide personne.
 */
export function EpinglesDuGroupe({
  tripId,
  dejaAuProgramme,
  onChoisir,
}: {
  tripId: string;
  /** Titres déjà présents dans la journée, pour ne pas les reproposer. */
  dejaAuProgramme: readonly string[];
  onChoisir: (epingle: Epingle) => void;
}) {
  const discussion = getDiscussion();

  const epingles = useQuery({
    queryKey: ['epingles', tripId],
    queryFn: () => discussion!.listPins(tripId),
    enabled: Boolean(discussion),
  });

  const posees = (epingles.data ?? []).filter(
    (epingle) => !dejaAuProgramme.includes(epingle.label),
  );
  if (posees.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-muted flex items-center gap-1.5 text-xs font-medium">
        <Pin className="size-3.5" aria-hidden />
        Épinglés dans la discussion
      </p>
      <ul className="space-y-1.5">
        {posees.map((epingle) => (
          <li key={epingle.id}>
            <button
              type="button"
              onClick={() => onChoisir(epingle)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl p-2 text-left',
                'hover:bg-brand-50 dark:hover:bg-ink-700/40 min-h-11',
              )}
            >
              <span
                aria-hidden
                className="bg-gold-500/15 text-gold-700 dark:text-gold-300 grid size-11 shrink-0 place-items-center rounded-lg"
              >
                <MapPin className="size-5" />
              </span>
              <span className="min-w-0 flex-1 pt-0.5">
                <span className="block truncate text-sm font-medium">{epingle.label}</span>
                {epingle.address && (
                  <span className="text-muted block truncate text-xs">{epingle.address}</span>
                )}
                {!epingle.address && epingle.lat === null && (
                  <span className="text-muted block text-xs">Sans adresse pour l’instant</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
