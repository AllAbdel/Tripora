import { useMemo } from 'react';
import { COLONNES, LIGNES, pointsDeTerre, projeter } from '@/lib/carteDuMonde';

/** Un voyage sur la carte : d'où l'on est parti, où l'on est allé. */
export interface VoyageSurLaCarte {
  id: string;
  nom: string;
  destination: { lat: number; lng: number } | null;
  origine: { lat: number; lng: number } | null;
}

/** L'écart entre deux points de la grille, en unités du dessin. */
const CASE = 10;
const OR = '#f5b301';
const BLEU = '#0A84FF';

/**
 * La carte du monde du passeport : les pays visités s'allument en or, un arc
 * relie la ville de départ à chaque destination, une épingle marque chaque
 * voyage.
 *
 * En points plutôt qu'en frontières : deux tracés SVG (la terre, les pays
 * visités), quelques kilo-octets, lisible sans réseau, et une allure de carte
 * de voyageur plutôt que d'atlas. Les très petits pays, qui n'ont pas de point
 * à cette échelle, ont leur épingle.
 */
export function CarteDuMonde({
  paysVisites,
  voyages,
}: {
  /** Codes ISO, avec leur nom pour la description. */
  paysVisites: readonly { code: string; nom: string }[];
  voyages: readonly VoyageSurLaCarte[];
}) {
  const codes = useMemo(() => new Set(paysVisites.map((pays) => pays.code.toUpperCase())), [paysVisites]);

  const [terre, visitee] = useMemo(() => {
    let reste = '';
    let allumee = '';
    for (const point of pointsDeTerre()) {
      // Un trait de longueur nulle aux bouts arrondis : un point, sans un
      // élément par point.
      const trait = `M${point.colonne * CASE + CASE / 2} ${point.ligne * CASE + CASE / 2}h0`;
      if (codes.has(point.code)) allumee += trait;
      else reste += trait;
    }
    return [reste, allumee];
  }, [codes]);

  const lieux = voyages.filter((voyage): voyage is VoyageSurLaCarte & { destination: { lat: number; lng: number } } =>
    Boolean(voyage.destination),
  );

  const departs = useMemo(() => {
    const vus = new Map<string, { x: number; y: number }>();
    for (const voyage of voyages) {
      if (!voyage.origine) continue;
      const { x, y } = projeter(voyage.origine.lat, voyage.origine.lng);
      vus.set(`${Math.round(x)}:${Math.round(y)}`, { x: x * CASE, y: y * CASE });
    }
    return [...vus.values()];
  }, [voyages]);

  const description =
    paysVisites.length === 0
      ? 'Carte du monde : aucun pays visité pour l’instant.'
      : `Carte du monde : ${paysVisites.length} pays visité${paysVisites.length > 1 ? 's' : ''} — ${paysVisites
          .map((pays) => pays.nom)
          .join(', ')}.`;

  return (
    <svg
      viewBox={`0 0 ${COLONNES * CASE} ${LIGNES * CASE}`}
      role="img"
      aria-label={description}
      className="h-auto w-full"
    >
      <path
        d={terre}
        className="text-muted"
        stroke="currentColor"
        strokeOpacity={0.3}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path d={visitee} stroke={OR} strokeWidth={7} strokeLinecap="round" />

      {lieux.map((voyage) => {
        if (!voyage.origine) return null;
        const depart = projeter(voyage.origine.lat, voyage.origine.lng);
        const arrivee = projeter(voyage.destination.lat, voyage.destination.lng);
        const x1 = depart.x * CASE;
        const y1 = depart.y * CASE;
        const x2 = arrivee.x * CASE;
        const y2 = arrivee.y * CASE;
        // L'arc monte d'autant plus que le voyage est long, comme une route
        // aérienne sur une carte à plat.
        const longueur = Math.hypot(x2 - x1, y2 - y1);
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2 - longueur * 0.3;
        return (
          <path
            key={`arc-${voyage.id}`}
            d={`M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`}
            fill="none"
            stroke={BLEU}
            strokeOpacity={0.7}
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray="1 8"
          />
        );
      })}

      {departs.map((depart) => (
        <circle key={`depart-${depart.x}-${depart.y}`} cx={depart.x} cy={depart.y} r={9} fill={BLEU} stroke="#fff" strokeWidth={3} />
      ))}

      {lieux.map((voyage) => {
        const { x, y } = projeter(voyage.destination.lat, voyage.destination.lng);
        return (
          <circle key={`lieu-${voyage.id}`} cx={x * CASE} cy={y * CASE} r={11} fill={OR} stroke="#fff" strokeWidth={3}>
            <title>{voyage.nom}</title>
          </circle>
        );
      })}
    </svg>
  );
}
