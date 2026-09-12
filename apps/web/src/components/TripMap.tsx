import { useEffect, useRef, useState } from 'react';
import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  type ErrorEvent,
  type StyleSpecification,
} from 'maplibre-gl';
import { setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import adresseDeLOuvrier from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
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

/**
 * Où trouver l'ouvrier de rendu de MapLibre.
 *
 * Sans cette ligne, la carte est noire — et muette, ce qui est pire.
 *
 * MapLibre ne construit plus son ouvrier à partir d'un blob : il le charge
 * comme un fichier voisin, en calculant son adresse à partir de `import.meta`
 * de son propre module. Une fois la bibliothèque empaquetée par Vite dans
 * `assets/TripMapScreen-xxxx.js`, cette adresse devient
 * `assets/maplibre-gl-worker.mjs` — un fichier que le build n'émet pas. La
 * requête part, revient 404, l'ouvrier ne démarre jamais.
 *
 * Et rien ne le signale : sans ouvrier, aucune tuile n'est décodée, mais
 * MapLibre n'émet pas d'évènement d'erreur pour autant. Le style se charge, sa
 * couleur de fond s'affiche — rgb(12,12,12) pour le fond sombre
 * d'OpenFreeMap — les repères se posent par-dessus, et la carte reste un
 * rectangle noir. Ni la console, ni le réseau, ni la CSP n'y sont pour quelque
 * chose.
 *
 * `?worker&url` demande à Vite d'empaqueter l'ouvrier et ses dépendances en un
 * fichier versionné, et de nous en rendre l'adresse. On la donne à MapLibre
 * avant toute création de carte.
 */
setWorkerUrl(adresseDeLOuvrier);

const FONDS = {
  clair: 'https://tiles.openfreemap.org/styles/positron',
  sombre: 'https://tiles.openfreemap.org/styles/dark',
} as const;

/**
 * Fond de secours quand les tuiles ne répondent pas.
 *
 * Deux teintes, parce qu'une plaque gris clair posée au milieu d'une interface
 * sombre ressemble à un bug, alors que le repli doit ressembler à une carte
 * qu'on n'a pas pu charger.
 */
function fondDegrade(sombre: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: 'vide',
        type: 'background',
        paint: { 'background-color': sombre ? '#1c2333' : '#dfe6f0' },
      },
    ],
  };
}

/**
 * Délai au-delà duquel on considère que le fond de carte ne viendra pas.
 *
 * Il ne suffit pas d'écouter les erreurs : une tuile absente répond 404, et
 * MapLibre traite ce cas comme « pas de données ici » sans rien signaler —
 * c'est le comportement voulu pour un jeu de tuiles partiel. Le résultat, sur
 * un jeu entièrement injoignable, est une carte parfaitement muette : le style
 * se charge, sa couleur de fond s'affiche, et rien d'autre n'arrive jamais.
 * Sur le fond sombre d'OpenFreeMap, cette couleur est rgb(12,12,12) — un
 * rectangle noir sous les repères, sans le moindre message.
 *
 * On surveille donc l'état réel : passé ce délai, si aucune tuile n'est
 * arrivée, on bascule sur le fond de repli et on le dit.
 */
const DELAI_TUILES_MS = 8000;

export interface MapMarker {
  id: string;
  point: GeoPoint;
  label: string;
  /** Texte court affiché dans la pastille : un rang, une initiale. */
  /** Un chiffre de rang. Jamais un émoji : voir `glyphe` pour les symboles. */
  badge?: string;
  /** Un pictogramme dessiné, quand le repère ne porte pas de rang. */
  glyphe?: Glyphe;
  kind: 'origin' | 'destination' | 'chosen' | 'place' | 'pin';
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

  // Le thème au moment de la création, figé : l'effet de création ne dépend
  // plus du thème, il lui faut donc une valeur qui ne le fasse pas se rejouer.
  const sombreAuDepart = useRef(sombre);

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

  /**
   * Création de la carte, une seule fois pour toute la vie du composant.
   *
   * Le thème n'est volontairement pas une dépendance : il l'a été, et chaque
   * bascule clair/sombre détruisait puis reconstruisait la carte entière —
   * pendant que l'effet de suivi du thème, juste en dessous, appelait de son
   * côté `setStyle` sur la carte à peine née. Deux téléchargements du style à
   * chaque montage, et un avertissement de MapLibre à chaque fois. Le thème se
   * suit par `setStyle`, et rien d'autre.
   */
  useEffect(() => {
    if (!container.current || carte.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: sombreAuDepart.current ? FONDS.sombre : FONDS.clair,
      center: [2.35, 46.6],
      zoom: 4,
      attributionControl: { compact: true },
    });
    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.on('error', (evenement: ErrorEvent) => {
      // Réseau filtré, hors ligne, style introuvable : là, MapLibre parle.
      if (String(evenement.error?.message ?? '').match(/style|fetch|load/i)) {
        setTuilesIndisponibles(true);
      }
    });
    carte.current = instance;

    return () => {
      instance.remove();
      carte.current = null;
    };
  }, []);

  // Suivi du thème.
  useEffect(() => {
    const instance = carte.current;
    if (!instance || tuilesIndisponibles) return;
    instance.setStyle(sombre ? FONDS.sombre : FONDS.clair);
  }, [sombre, tuilesIndisponibles]);

  /**
   * Surveillance des tuiles : le seul filet qui attrape l'échec silencieux.
   *
   * `loaded()` reste faux tant qu'une source attend ses tuiles, et le reste
   * indéfiniment quand elles ne viennent pas. On le relit une fois, passé le
   * délai, plutôt que d'attendre un évènement qui n'arrivera pas.
   */
  useEffect(() => {
    const instance = carte.current;
    if (!instance || tuilesIndisponibles) return;

    const minuteur = window.setTimeout(() => {
      if (!carte.current || carte.current.loaded()) return;
      setTuilesIndisponibles(true);
    }, DELAI_TUILES_MS);

    return () => window.clearTimeout(minuteur);
  }, [sombre, tuilesIndisponibles]);

  // Bascule effective sur le fond de repli, dans le ton du thème.
  useEffect(() => {
    const instance = carte.current;
    if (!instance || !tuilesIndisponibles) return;
    try {
      instance.setStyle(fondDegrade(sombre));
    } catch {
      /* la carte a déjà été détruite */
    }
  }, [tuilesIndisponibles, sombre]);

  // Repères et cadrage.
  useEffect(() => {
    const instance = carte.current;
    if (!instance || markers.length === 0) return;

    const poses = markers.map((marker) => {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = classePourRepere(marker.kind);
      if (marker.glyphe) element.append(dessinerGlyphe(marker.glyphe));
      else element.textContent = marker.badge ?? '';
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
          Fond de carte indisponible pour le moment. Les repères restent à leur place.
        </p>
      )}
    </div>
  );
}

export type Glyphe = 'depart' | 'etoile' | 'epingle';

/**
 * Les tracés des pictogrammes posés sur la carte.
 *
 * Ce sont des chemins SVG et non des émojis : sur la carte comme ailleurs, un
 * émoji change de dessin selon l'appareil, ignore la couleur du repère et ne
 * suit pas sa taille. Trois formes suffisent — d'où venir, ce qui est choisi,
 * ce que le groupe a épinglé.
 */
const TRACES: Readonly<Record<Glyphe, string>> = {
  depart: 'M12 19V5m0 0-6 6m6-6 6 6',
  etoile: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 9.5l6.1-.9z',
  epingle: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z M12 10.5v.01',
};

/**
 * Construit le pictogramme nœud par nœud plutôt qu'en affectant `innerHTML`.
 *
 * Le contenu est pourtant une constante du fichier : la règle du projet est
 * qu'aucun HTML ne s'assemble par chaîne de caractères, sans exception à
 * juger au cas par cas. Trois lignes de plus, et la question ne se pose plus.
 */
function dessinerGlyphe(glyphe: Glyphe): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const trace = document.createElementNS(NS, 'path');
  trace.setAttribute('d', TRACES[glyphe]);
  svg.append(trace);
  return svg;
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
    case 'pin':
      // Choisis par le groupe, pas ramenés d'une base de données : ils se
      // distinguent des lieux suggérés, et se voient d'un coup d'œil.
      return `${base} bg-gold-600 ring-2 ring-gold-300/70`;
    default:
      return `${base} bg-brand-500`;
  }
}
