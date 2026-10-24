import { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';

/**
 * Le court moment entre « Créer le voyage » et l'écran du voyage.
 *
 * L'enregistrement prend une fraction de seconde ; sans rien, l'écran saute
 * d'un coup, et l'on se demande si l'appui a été pris. Ici, un trajet se trace
 * entre deux points, un avion le suit, et trois étapes défilent ; puis un
 * cercle se ferme sur une coche. Une seconde et demie en tout, jamais plus :
 * c'est un passage, pas une attente (`CreateTrip` décide de la durée, et
 * passe directement quand l'appareil demande moins d'animations).
 *
 * Les étapes disent ce qui se prépare vraiment : le trip, le budget, les
 * propositions de destination.
 */

const ETAPES = ['Composition du trip…', 'Calcul du budget…', 'Préparation des propositions…'];

/** Le trajet de l'avion : le même pour le tracé (SVG) et le vol (`offset-path`). */
const TRAJET = 'M 22 70 C 70 6, 150 6, 198 54';

export function CreationDuVoyage({ reussie }: { reussie: boolean }) {
  const [etape, setEtape] = useState(0);
  useEffect(() => {
    if (reussie) return;
    const minuterie = window.setInterval(() => setEtape((rang) => Math.min(rang + 1, ETAPES.length - 1)), 420);
    return () => window.clearInterval(minuterie);
  }, [reussie]);

  return (
    <div
      className="creation-voile fixed inset-0 z-[60] grid place-items-center bg-[color:var(--surface-muted)]/80 px-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="creation-carte surface-raised w-full max-w-xs rounded-[var(--radius-sheet)] border border-[color:var(--border-subtle)] p-6 text-center shadow-[var(--shadow-lift)]">
        {reussie ? (
          <div className="creation-reussie mx-auto grid size-[90px] place-items-center">
            <svg viewBox="0 0 60 60" width="72" height="72" fill="none" aria-hidden>
              <circle
                className="creation-cercle"
                cx="30"
                cy="30"
                r="26"
                stroke="var(--color-lagoon-500)"
                strokeWidth="3"
                strokeLinecap="round"
                transform="rotate(-90 30 30)"
              />
              <path
                className="creation-coche"
                d="M19 31l7 7 15-16"
                stroke="var(--color-lagoon-500)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : (
          // Taille fixe : l'avion vole en pixels sur le même tracé que le SVG.
          <div className="relative mx-auto h-[90px] w-[220px]" aria-hidden>
            <svg viewBox="0 0 220 90" width="220" height="90" fill="none" className="absolute inset-0">
              <path className="creation-trajet" d={TRAJET} stroke="var(--border-fort)" strokeWidth="2" />
              <path
                className="creation-trace"
                d={TRAJET}
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle className="creation-point" cx="22" cy="70" r="5" fill="var(--accent)" />
              <circle
                className="creation-point creation-point-arrivee"
                cx="198"
                cy="54"
                r="5"
                fill="var(--color-lagoon-500)"
              />
            </svg>
            <span className="creation-avion text-brand-600 dark:text-brand-300 absolute top-0 left-0 grid size-6 place-items-center">
              {/* Le pictogramme pointe en haut à droite : on le remet dans l'axe du trajet. */}
              <Plane className="size-5 rotate-45 fill-current" />
            </span>
          </div>
        )}

        <div className="mt-4 h-6 overflow-hidden">
          {reussie ? (
            <p key="fini" className="creation-etape font-semibold">
              Trip créé
            </p>
          ) : (
            <p key={etape} className="creation-etape text-muted text-sm">
              {ETAPES[etape]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
