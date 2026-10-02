import { useRef, useState } from 'react';
import { CloudDownload, MapPinned, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import {
  TelechargementInterrompu,
  carteHorsLignePossible,
  poidsAnnonce,
  supprimerLaCarte,
  telechargerLaCarte,
  useCartesHorsLigne,
  type DestinationACarte,
} from '@/lib/carteHorsLigne';
import { signaler } from '@/lib/feedback';

function megaoctets(octets: number): string {
  return `${Math.max(1, Math.round(octets / (1024 * 1024)))} Mo`;
}

/**
 * « Télécharger la carte » : la destination gardée sur l'appareil, pour la
 * consulter sans réseau — à l'arrivée sans forfait, dans le métro, au bout
 * d'un chemin sans antenne. Le poids est annoncé avant, et la carte se
 * supprime d'un geste au retour.
 */
export function CarteHorsLigne({ destination }: { destination: DestinationACarte }) {
  const cartes = useCartesHorsLigne();
  const gardee = cartes[destination.id];
  const [progres, setProgres] = useState<{ fait: number; total: number } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [suppression, setSuppression] = useState(false);
  const abandon = useRef<AbortController | null>(null);

  if (!carteHorsLignePossible) return null;

  async function telecharger() {
    setErreur(null);
    const controleur = new AbortController();
    abandon.current = controleur;
    setProgres({ fait: 0, total: 1 });
    try {
      await telechargerLaCarte(destination, {
        signal: controleur.signal,
        surProgres: (fait, total) => setProgres({ fait, total }),
      });
      signaler('reussite');
    } catch (cause) {
      if (!controleur.signal.aborted) {
        setErreur(
          cause instanceof TelechargementInterrompu
            ? cause.message
            : 'La carte n’a pas pu être gardée : l’appareil manque peut-être de place.',
        );
      }
    } finally {
      abandon.current = null;
      setProgres(null);
    }
  }

  async function supprimer() {
    setSuppression(true);
    try {
      await supprimerLaCarte(destination.id);
    } finally {
      setSuppression(false);
    }
  }

  const pourcentage = progres ? Math.round((progres.fait / Math.max(1, progres.total)) * 100) : 0;

  return (
    <Card>
      <CardBody className="space-y-3">
        <p className="etiquette flex items-center gap-1.5">
          <MapPinned className="size-3.5" aria-hidden />
          Carte hors ligne
        </p>

        {progres ? (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm">Téléchargement de la carte de {destination.name}…</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pourcentage}
              aria-label="Téléchargement de la carte"
              className="h-1.5 overflow-hidden rounded-full bg-[color:var(--border-subtle)]"
            >
              <div
                className="bg-brand-500 h-full rounded-full transition-[width] duration-300"
                style={{ width: `${pourcentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-muted chiffres text-xs">{pourcentage} %</p>
              <button
                type="button"
                onClick={() => abandon.current?.abort()}
                className="text-muted min-h-10 text-sm underline"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : gardee ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">La carte de {gardee.nom} est sur cet appareil.</span>{' '}
              <span className="text-muted">
                {megaoctets(gardee.octets)}, gardée le{' '}
                {new Date(gardee.telechargeeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. Elle
                s’affiche même sans réseau.
              </span>
            </p>
            <div className="flex flex-wrap gap-x-5">
              <button
                type="button"
                onClick={() => void telecharger()}
                className="text-brand-600 dark:text-brand-300 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold"
              >
                <CloudDownload className="size-4" aria-hidden />
                Mettre à jour
              </button>
              <button
                type="button"
                onClick={() => void supprimer()}
                disabled={suppression}
                className="text-muted inline-flex min-h-10 items-center gap-1.5 text-sm underline disabled:opacity-60"
              >
                <Trash2 className="size-4" aria-hidden />
                {suppression ? 'Suppression…' : 'Supprimer la carte'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-muted text-sm leading-relaxed">
              Gardez la carte de {destination.name} sur cet appareil : les rues, les plages et les lieux du programme
              restent consultables sans réseau, à l’arrivée comme en itinérance. Environ{' '}
              {megaoctets(poidsAnnonce(destination))}, à télécharger de préférence en wifi.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<CloudDownload className="size-4" aria-hidden />}
              onClick={() => void telecharger()}
            >
              Télécharger la carte
            </Button>
          </div>
        )}

        {erreur && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {erreur}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
