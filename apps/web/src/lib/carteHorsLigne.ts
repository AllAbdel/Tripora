import { useSyncExternalStore } from 'react';
import {
  BANDES_DU_RELIEF,
  BANDES_VECTORIELLES,
  adresseDeLaTuile,
  planDesTuiles,
  plagesDeCaracteres,
  poidsEstime,
  type GeoPoint,
} from '@tripora/core';

/**
 * La carte de la destination, gardée sur l'appareil pour s'en servir sans
 * réseau : à l'arrivée, sans forfait, ou dans une ruelle sans antenne.
 *
 * Le téléchargement range dans le stockage du navigateur (Cache API) tout ce
 * que la carte demande pour dessiner la destination : les deux styles (clair
 * et sombre), leurs pictogrammes, les polices des noms, et quelques centaines
 * de tuiles en entonnoir autour de la ville (voir `tuiles.ts`). La carte lit
 * ensuite ces ressources en priorité, par un protocole que `TripMap` déclare
 * à MapLibre : le même mécanisme sert le site et l'application Android, qui
 * n'a pas de service worker.
 *
 * Les tuiles de chaque destination ont leur propre cache, supprimable d'un
 * geste ; styles, polices et pictogrammes sont communs à toutes.
 */

const SERVEUR = 'https://tiles.openfreemap.org';
export const STYLES = {
  clair: `${SERVEUR}/styles/positron`,
  sombre: `${SERVEUR}/styles/dark`,
} as const;

const CACHE_COMMUN = 'tripora-carte-commun';
const cacheDeLaDestination = (id: string) => `tripora-carte-${id}`;
const CLE = 'tripora.cartes-hors-ligne';
const EN_PARALLELE = 6;

export interface CarteTelechargee {
  destinationId: string;
  nom: string;
  octets: number;
  ressources: number;
  telechargeeLe: string;
}

export interface DestinationACarte extends GeoPoint {
  id: string;
  name: string;
  countryCode?: string;
}

export const carteHorsLignePossible: boolean = typeof caches !== 'undefined';

/* ---------------------------------------------------------- Ce qui est là -- */

const abonnes = new Set<() => void>();
let instantane: Record<string, CarteTelechargee> | null = null;

function lire(): Record<string, CarteTelechargee> {
  if (instantane) return instantane;
  try {
    const brut = localStorage.getItem(CLE);
    instantane = brut ? (JSON.parse(brut) as Record<string, CarteTelechargee>) : {};
  } catch {
    instantane = {};
  }
  return instantane;
}

function ecrire(cartes: Record<string, CarteTelechargee>): void {
  instantane = cartes;
  try {
    localStorage.setItem(CLE, JSON.stringify(cartes));
  } catch {
    // Stockage refusé : la carte reste en cache, on l'oubliera au rechargement.
  }
  for (const abonne of abonnes) abonne();
}

const VIDE: Record<string, CarteTelechargee> = {};

export function useCartesHorsLigne(): Record<string, CarteTelechargee> {
  return useSyncExternalStore(
    (abonne) => {
      abonnes.add(abonne);
      return () => abonnes.delete(abonne);
    },
    lire,
    () => VIDE,
  );
}

/** Vrai dès qu'une carte est gardée : la carte passe alors par le cache. */
export function cartesHorsLignePresentes(): boolean {
  return carteHorsLignePossible && Object.keys(lire()).length > 0;
}

/* ------------------------------------------------------------ Le plan -- */

interface Style {
  sprite?: string | { id: string; url: string }[];
  glyphs?: string;
  sources?: Record<string, { type: string; url?: string; tiles?: string[]; maxzoom?: number }>;
  layers?: { layout?: { 'text-font'?: unknown } }[];
}

async function lireJson<T>(adresse: string, signal: AbortSignal): Promise<T> {
  const reponse = await fetch(adresse, { signal });
  if (!reponse.ok) throw new Error(`${adresse} : ${reponse.status}`);
  return (await reponse.json()) as T;
}

function sprites(style: Style): string[] {
  const bases = typeof style.sprite === 'string' ? [style.sprite] : (style.sprite ?? []).map((entree) => entree.url);
  return bases.flatMap((base) => [`${base}.json`, `${base}.png`, `${base}@2x.json`, `${base}@2x.png`]);
}

function polices(style: Style): string[] {
  const piles = new Set<string>();
  for (const couche of style.layers ?? []) {
    const police = couche.layout?.['text-font'];
    if (Array.isArray(police) && police.every((nom) => typeof nom === 'string')) piles.add(police.join(','));
  }
  return [...piles];
}

/**
 * La liste des adresses à garder pour une destination : les ressources
 * communes d'un côté, les tuiles de la destination de l'autre.
 */
export async function planDeLaCarte(
  destination: DestinationACarte,
  signal: AbortSignal,
): Promise<{ communes: string[]; tuiles: string[] }> {
  const styles = await Promise.all(Object.values(STYLES).map((adresse) => lireJson<Style>(adresse, signal)));
  const communes = new Set<string>(Object.values(STYLES));
  const tuiles = new Set<string>();
  const sourcesVues = new Set<string>();

  for (const style of styles) {
    for (const sprite of sprites(style)) communes.add(sprite);
    if (style.glyphs) {
      for (const pile of polices(style)) {
        for (const plage of plagesDeCaracteres(destination.countryCode)) {
          communes.add(style.glyphs.replace('{fontstack}', pile).replace('{range}', plage));
        }
      }
    }
    for (const source of Object.values(style.sources ?? {})) {
      const cle = source.url ?? source.tiles?.[0] ?? '';
      if (!cle || sourcesVues.has(cle)) continue;
      sourcesVues.add(cle);
      let gabarit = source.tiles?.[0];
      let zoomMax = source.maxzoom ?? 14;
      if (source.url) {
        // Une source décrite à part (TileJSON) : c'est elle qui donne
        // l'adresse des tuiles, datée de leur dernière génération.
        communes.add(source.url);
        const description = await lireJson<{ tiles?: string[]; maxzoom?: number }>(source.url, signal);
        gabarit = description.tiles?.[0];
        zoomMax = description.maxzoom ?? zoomMax;
      }
      if (!gabarit) continue;
      const bandes = source.type === 'raster' ? BANDES_DU_RELIEF : BANDES_VECTORIELLES;
      // Une source raster s'arrête un cran avant son zoom maximal : au-delà,
      // la carte ne la montre plus.
      const plafond = source.type === 'raster' ? zoomMax - 1 : zoomMax;
      for (const tuile of planDesTuiles(destination, bandes, plafond)) tuiles.add(adresseDeLaTuile(gabarit, tuile));
    }
  }
  return { communes: [...communes], tuiles: [...tuiles] };
}

/** Ce qu'on annonce avant de télécharger, sans rien demander au réseau. */
export function poidsAnnonce(destination: DestinationACarte): number {
  return poidsEstime(
    planDesTuiles(destination, BANDES_VECTORIELLES, 14).length + planDesTuiles(destination, BANDES_DU_RELIEF, 5).length,
  );
}

/* ---------------------------------------------------- Le téléchargement -- */

export class TelechargementInterrompu extends Error {}

export async function telechargerLaCarte(
  destination: DestinationACarte,
  { surProgres, signal }: { surProgres: (fait: number, total: number) => void; signal: AbortSignal },
): Promise<CarteTelechargee> {
  if (!carteHorsLignePossible) throw new TelechargementInterrompu('Ce navigateur ne sait pas garder de carte.');
  let plan: { communes: string[]; tuiles: string[] };
  try {
    plan = await planDeLaCarte(destination, signal);
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new TelechargementInterrompu('Le serveur de cartes ne répond pas. Réessayez une fois connecté.');
  }

  const commun = await caches.open(CACHE_COMMUN);
  const propre = await caches.open(cacheDeLaDestination(destination.id));
  const taches = [
    ...plan.communes.map((adresse) => ({ adresse, cache: commun })),
    ...plan.tuiles.map((adresse) => ({ adresse, cache: propre })),
  ];
  let fait = 0;
  let octets = 0;
  let echecs = 0;
  surProgres(0, taches.length);

  // Six à la fois : assez pour aller vite, pas assez pour se faire refuser
  // par un serveur communautaire qui nous sert gratuitement.
  let suivante = 0;
  async function ouvrier(): Promise<void> {
    while (suivante < taches.length) {
      const { adresse, cache } = taches[suivante]!;
      suivante += 1;
      if (signal.aborted) return;
      try {
        const reponse = await fetch(adresse, { signal });
        // Une tuile d'océan peut ne pas exister : ce n'est pas un échec.
        if (reponse.ok) {
          const contenu = await reponse.blob();
          octets += contenu.size;
          await cache.put(adresse, new Response(contenu, { headers: reponse.headers }));
        }
      } catch {
        if (signal.aborted) return;
        echecs += 1;
      }
      fait += 1;
      surProgres(fait, taches.length);
    }
  }
  await Promise.all(Array.from({ length: EN_PARALLELE }, () => ouvrier()));

  if (signal.aborted) {
    await caches.delete(cacheDeLaDestination(destination.id));
    throw new DOMException('Téléchargement annulé', 'AbortError');
  }
  if (echecs > taches.length * 0.1) {
    await caches.delete(cacheDeLaDestination(destination.id));
    throw new TelechargementInterrompu('La connexion a coupé pendant le téléchargement. Réessayez sur un meilleur réseau.');
  }

  // Le navigateur peut vider son stockage quand la place manque : on lui
  // demande de garder celui-ci. Accordé d'office à une application installée.
  void navigator.storage?.persist?.().catch(() => false);

  const carte: CarteTelechargee = {
    destinationId: destination.id,
    nom: destination.name,
    octets,
    ressources: taches.length - echecs,
    telechargeeLe: new Date().toISOString(),
  };
  ecrire({ ...lire(), [destination.id]: carte });
  return carte;
}

export async function supprimerLaCarte(destinationId: string): Promise<void> {
  const { [destinationId]: _supprimee, ...restantes } = lire();
  await caches.delete(cacheDeLaDestination(destinationId));
  if (Object.keys(restantes).length === 0) await caches.delete(CACHE_COMMUN);
  ecrire(restantes);
}

/* ------------------------------------------------------------ La lecture -- */

/** Une ressource ni gardée ni joignable : pour une tuile, ce n'est pas une panne. */
export class RessourceAbsente extends Error {}

const DELAI_RESEAU_MS = 4000;

/** Les styles et la description des tuiles changent : on préfère le réseau, s'il répond vite. */
function changeSouvent(adresse: string): boolean {
  return adresse.startsWith(`${SERVEUR}/styles/`) || /^https:\/\/tiles\.openfreemap\.org\/[a-z_]+$/u.test(adresse);
}

/**
 * Lit une ressource de la carte : depuis l'appareil d'abord pour ce qui ne
 * change pas (tuiles, polices, pictogrammes), depuis le réseau d'abord pour
 * le reste. Utilisée par le protocole que `TripMap` déclare à MapLibre.
 */
export async function lireRessourceDeCarte(
  adresse: string,
  type: string | undefined,
  signal: AbortSignal,
): Promise<unknown> {
  let reponse: Response | undefined;
  if (changeSouvent(adresse)) {
    const delai = new AbortController();
    const minuteur = setTimeout(() => delai.abort(), DELAI_RESEAU_MS);
    signal.addEventListener('abort', () => delai.abort(), { once: true });
    try {
      const reseau = await fetch(adresse, { signal: delai.signal });
      if (reseau.ok) reponse = reseau;
    } catch {
      // Hors ligne ou trop lent : la copie gardée fera l'affaire.
    } finally {
      clearTimeout(minuteur);
    }
    reponse ??= await caches.match(adresse);
  } else {
    reponse = await caches.match(adresse);
    if (!reponse) {
      try {
        const reseau = await fetch(adresse, { signal });
        if (reseau.ok) reponse = reseau;
      } catch (cause) {
        if (signal.aborted) throw cause;
      }
    }
  }
  if (!reponse) throw new RessourceAbsente(adresse);
  if (type === 'json') return reponse.json();
  if (type === 'string') return reponse.text();
  return reponse.arrayBuffer();
}

/** La carte passe par Tripora pour ces adresses-là. */
export const PROTOCOLE = 'tripora-carte';

export function versLeProtocole(adresse: string): string | null {
  return adresse.startsWith(`${SERVEUR}/`) ? `${PROTOCOLE}://${adresse.slice('https://'.length)}` : null;
}

export function depuisLeProtocole(adresse: string): string {
  return `https://${adresse.slice(`${PROTOCOLE}://`.length)}`;
}
