import { useEffect, useRef, useState } from 'react';
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type ErrorEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoPoint } from '@tripora/core';
import { useTheme } from '@/stores/theme';

/**
 * Carte du voyage.
 *
 * Fond de carte OpenFreeMap : vectoriel, sans clé d'API, sans quota annoncé et
 * sans carte bancaire. Google Maps et Mapbox exigent l'un comme l'autre un
 * moyen de paiement dès la première tuile, ce qui est éliminatoire ici.
 *
 * La bibliothèque est chargée à la demande par la route : elle pèse à elle
 * seule plus que tout le reste de l'application, et la plupart des écrans n'en
 * ont pas besoin.
 */

const FONDS = {
  clair: 'https://tiles.openfreemap.org/styles/positron',
  sombre: 'https://tiles.openfreemap.org/styles/dark',
} as const;

/** Fond de secours si les tuiles ne répondent pas : une carte grise vaut mieux
 *  qu'un écran blanc, et les repères restent lisibles. */
const FOND_DEGRADE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'vide', type: 'background', paint: { 'background-color': '#dfe6f0' } }],
};

export interface MapMarker {
  id: string;
  point: GeoPoint;
  label: string;
  /** Texte court affiché dans la pastille : un rang, une initiale. */
  badge?: string;
  kind: 'origin' | 'destination' | 'chosen' | 'place';
  onSelect?: () => void;
}

export function TripMap({
  markers,
  route,
  className,
}: {
  markers: MapMarker[];
  /** Trait entre deux points, pour matérialiser le trajet retenu. */
  route?: [GeoPoint, GeoPoint] | null;
  className?: string;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const carte = useRef<MapLibreMap | null>(null);
  const debutGeste = useRef<{ x: number; y: number } | null>(null);
  const { preference } = useTheme();
  const [tuilesIndisponibles, setTuilesIndisponibles] = useState(false);

  const sombre =
    preference === 'dark' ||
    (preference === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches === true);

  /**
   * Position du doigt au début du geste, relevée au niveau du document en
   * phase de capture.
   *
   * MapLibre intercepte `pointerdown` sur ses propres repères et interrompt la
   * chaîne d'écouteurs : l'évènement `click` n'est donc jamais émis, et un
   * gestionnaire posé dessus ne se déclenche pas pour un vrai doigt ni une
   * vraie souris — seulement pour un clic simulé. On écoute donc `pointerup`,
   * qui passe, et on relève le point de départ ici pour distinguer une
   * tape d'un déplacement de la carte qui finirait par hasard sur un repère.
   */
  useEffect(() => {
    const noter = (evenement: PointerEvent) => {
      debutGeste.current = { x: evenement.clientX, y: evenement.clientY };
    };
    document.addEventListener('pointerdown', noter, true);
    return () => document.removeEventListener('pointerdown', noter, true);
  }, []);

  // Création de la carte, une seule fois.
  useEffect(() => {
    if (!container.current || carte.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: sombre ? FONDS.sombre : FONDS.clair,
      center: [2.35, 46.6],
      zoom: 4,
      attributionControl: { compact: true },
    });
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.on('error', (evenement: ErrorEvent) => {
      // Tuiles injoignables (hors ligne, réseau filtré) : on bascule sur un
      // fond neutre au lieu de laisser un écran vide sans explication.
      if (String(evenement.error?.message ?? '').match(/style|fetch|load/i)) {
        setTuilesIndisponibles(true);
        try {
          instance.setStyle(FOND_DEGRADE);
        } catch {
          /* la carte a déjà été détruite */
        }
      }
    });
    carte.current = instance;

    return () => {
      instance.remove();
      carte.current = null;
    };
  }, [sombre]);

  // Suivi du thème.
  useEffect(() => {
    if (!carte.current || tuilesIndisponibles) return;
    carte.current.setStyle(sombre ? FONDS.sombre : FONDS.clair);
  }, [sombre, tuilesIndisponibles]);

  // Repères et cadrage.
  useEffect(() => {
    const instance = carte.current;
    if (!instance || markers.length === 0) return;

    const poses = markers.map((marker) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = classePourRepere(marker.kind);
      element.textContent = marker.badge ?? '';
      element.setAttribute('aria-label', marker.label);
      element.title = marker.label;

      const activer = marker.onSelect;
      if (activer) {
        element.addEventListener('pointerup', (evenement) => {
          const depart = debutGeste.current;
          const distance = depart
            ? Math.hypot(evenement.clientX - depart.x, evenement.clientY - depart.y)
            : 0;
          // Au-delà de quelques pixels, la personne déplaçait la carte.
          if (distance <= 8) activer();
        });
        // Un clic au clavier (Entrée, Espace) porte detail = 0 et passe, lui,
        // par `click` : c'est le seul cas où cet évènement nous parvient.
        element.addEventListener('click', (evenement) => {
          if (evenement.detail === 0) activer();
        });
      }

      return new Marker({ element })
        .setLngLat([marker.point.lng, marker.point.lat])
        .addTo(instance);
    });

    const bornes = new LngLatBounds();
    for (const marker of markers) bornes.extend([marker.point.lng, marker.point.lat]);
    // Deux échelles, et une seule règle : montrer ce qu'il y a à voir. Tant
    // qu'on compare des villes, on reste au niveau du continent ; dès qu'on
    // pose des lieux, on descend dans la rue.
    const rues = markers.some((marker) => marker.kind === 'place');
    instance.fitBounds(bornes, { padding: 64, maxZoom: rues ? 14 : 9, duration: 600 });

    return () => {
      for (const pose of poses) pose.remove();
    };
  }, [markers]);

  // Trait du trajet retenu.
  useEffect(() => {
    const instance = carte.current;
    if (!instance) return;

    const dessiner = () => {
      if (!instance.isStyleLoaded()) return;
      if (instance.getLayer('trajet')) instance.removeLayer('trajet');
      if (instance.getSource('trajet')) instance.removeSource('trajet');
      if (!route) return;

      instance.addSource('trajet', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: route.map((point) => [point.lng, point.lat]),
          },
        },
      });
      instance.addLayer({
        id: 'trajet',
        type: 'line',
        source: 'trajet',
        paint: {
          'line-color': '#0a84ff',
          'line-width': 2.5,
          'line-dasharray': [2, 1.5],
          'line-opacity': 0.8,
        },
      });
    };

    /**
     * Changer de fond de carte — bascule clair/sombre, ou repli hors ligne —
     * remplace le style et emporte avec lui sources et couches. Sans ce
     * redessin, le trajet disparaissait définitivement au premier changement
     * de thème. On ne redessine que s'il manque : ajouter une couche émet
     * lui-même un `styledata`, et la condition évite la boucle.
     */
    const auChangementDeStyle = () => {
      if (route && !instance.getLayer('trajet')) dessiner();
    };

    dessiner();
    instance.on('styledata', auChangementDeStyle);
    return () => {
      instance.off('styledata', auChangementDeStyle);
    };
  }, [route]);

  return (
    <div className={className}>
      <div ref={container} className="size-full" />
      {tuilesIndisponibles && (
        <p className="text-muted absolute inset-x-0 bottom-3 text-center text-xs">
          Fond de carte indisponible hors ligne. Les repères restent à leur place.
        </p>
      )}
    </div>
  );
}

function classePourRepere(kind: MapMarker['kind']): string {
  const base =
    'grid size-8 cursor-pointer place-items-center rounded-full border-2 border-white ' +
    'text-xs font-bold text-white shadow-lg transition-transform hover:scale-110';
  switch (kind) {
    case 'origin':
      return `${base} bg-ink-700`;
    case 'chosen':
      return `${base} bg-lagoon-500 size-10 text-sm`;
    case 'place':
      // Plus petits que les villes : ils sont nombreux et secondaires. La
      // carte doit rester lisible même avec cent points posés dessus.
      return `${base} bg-gold-500 size-6 text-[10px]`;
    default:
      return `${base} bg-brand-500`;
  }
}
