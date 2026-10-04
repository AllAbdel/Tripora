import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  currencyForCountry,
  isConvertible,
  reglerLaRegion,
  unitesDuPays,
  type Region,
  type UniteDeDistance,
  type UniteDeTemperature,
} from '@tripora/core';
import { etiquetteIntl, type Langue } from '@/i18n/langues';
import { chargerTaux } from '@/lib/fx';
import { resoudre, useLangue } from '@/stores/langue';

/**
 * Comment la personne veut lire les chiffres : sa devise, ses degrés, ses
 * distances.
 *
 * Chaque réglage vaut `'auto'` par défaut : il suit alors le pays que le
 * navigateur annonce (« en-US » : dollars, °F, miles ; « fr-FR » : euros,
 * °C, km). Le choix explicite, dans le profil, l'emporte toujours — un
 * Américain à Paris peut vouloir des degrés Celsius.
 *
 * La façon d'écrire les nombres et les dates suit la langue de l'interface,
 * précisée par le pays du navigateur quand c'est la même langue (« en-GB »
 * écrit « 2 October », « en-US » écrit « October 2 »).
 */

export type Choix<T> = 'auto' | T;

interface EtatDeRegion {
  devise: Choix<string>;
  temperature: Choix<UniteDeTemperature>;
  distance: Choix<UniteDeDistance>;
  /** Monte à chaque changement effectif : l'interface se redessine. */
  version: number;
  setDevise: (valeur: Choix<string>) => void;
  setTemperature: (valeur: Choix<UniteDeTemperature>) => void;
  setDistance: (valeur: Choix<UniteDeDistance>) => void;
}

function annoncees(): string[] {
  if (typeof navigator === 'undefined') return [];
  return [...(navigator.languages ?? []), navigator.language].filter(Boolean) as string[];
}

/** Le pays que le navigateur annonce (« US » pour « en-US »), s'il en annonce un. */
export function paysDuNavigateur(langues = annoncees()): string | null {
  for (const etiquette of langues) {
    const pays = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/u.exec(etiquette)?.[1];
    if (pays) return pays.toUpperCase();
  }
  return null;
}

/** L'étiquette `Intl` des nombres et des dates, pour une langue d'interface. */
export function localeDeFormat(langue: Langue, langues = annoncees()): string {
  const memeLangue = langues.find((etiquette) => etiquette.toLowerCase().startsWith(`${langue}-`));
  return memeLangue ?? etiquetteIntl(langue);
}

/** Les réglages effectifs, `'auto'` résolu. */
export function resoudreLaRegion(
  etat: Pick<EtatDeRegion, 'devise' | 'temperature' | 'distance'>,
  langue: Langue,
  langues = annoncees(),
): Omit<Region, 'tauxDeLaDevise'> {
  const pays = paysDuNavigateur(langues);
  const usage = unitesDuPays(pays);
  const deviseDuPays = pays ? currencyForCountry(pays) : undefined;
  const deviseAuto = deviseDuPays && isConvertible(deviseDuPays) ? deviseDuPays : 'EUR';
  return {
    locale: localeDeFormat(langue, langues),
    devise: etat.devise === 'auto' ? deviseAuto : etat.devise,
    temperature: etat.temperature === 'auto' ? usage.temperature : etat.temperature,
    distance: etat.distance === 'auto' ? usage.distance : etat.distance,
  };
}

const CLE_DES_TAUX = 'tripora.taux-du-jour';

/** Les derniers taux connus, gardés sur l'appareil : la conversion marche hors ligne. */
function tauxGardes(): { date: string; rates: Record<string, number> } | null {
  try {
    const lu = JSON.parse(localStorage.getItem(CLE_DES_TAUX) ?? 'null') as unknown;
    if (lu && typeof lu === 'object' && 'rates' in lu && 'date' in lu) return lu as { date: string; rates: Record<string, number> };
  } catch {
    // Rien de gardé, ou illisible : on reste en euros.
  }
  return null;
}

export const useRegion = create<EtatDeRegion>()(
  persist(
    (set) => ({
      devise: 'auto',
      temperature: 'auto',
      distance: 'auto',
      version: 0,
      setDevise: (devise) => set((etat) => ({ devise, version: etat.version + 1 })),
      setTemperature: (temperature) => set((etat) => ({ temperature, version: etat.version + 1 })),
      setDistance: (distance) => set((etat) => ({ distance, version: etat.version + 1 })),
    }),
    {
      name: 'tripora.region',
      partialize: (etat) => ({ devise: etat.devise, temperature: etat.temperature, distance: etat.distance }),
    },
  ),
);

let tauxDemandesLe: string | null = null;

/**
 * Pose les réglages effectifs dans le cœur (qui écrit tous les chiffres), et
 * va chercher le taux du jour quand la devise n'est pas l'euro. Sans taux —
 * mode local, hors ligne sans taux gardé —, les sommes restent en euros.
 */
export function appliquerLaRegion(): void {
  const etat = useRegion.getState();
  const reglages = resoudreLaRegion(etat, resoudre(useLangue.getState().preference));
  const gardes = tauxGardes();
  const taux = reglages.devise === 'EUR' ? null : (gardes?.rates[reglages.devise] ?? null);
  reglerLaRegion({ ...reglages, tauxDeLaDevise: taux });

  const aujourdHui = new Date().toISOString().slice(0, 10);
  if (reglages.devise === 'EUR' || tauxDemandesLe === aujourdHui || gardes?.date === aujourdHui) return;
  tauxDemandesLe = aujourdHui;
  void chargerTaux().then((reponse) => {
    if (reponse.statut !== 'ok') return;
    try {
      localStorage.setItem(CLE_DES_TAUX, JSON.stringify({ date: aujourdHui, rates: reponse.taux.rates }));
    } catch {
      // Stockage plein ou refusé : le taux vaut pour cette visite seulement.
    }
    const nouveau = reponse.taux.rates[reglages.devise] ?? null;
    if (nouveau !== taux) {
      reglerLaRegion({ tauxDeLaDevise: nouveau });
      useRegion.setState((courant) => ({ version: courant.version + 1 }));
    }
  });
}

/** Suit la langue et les réglages : chaque changement est reporté au cœur. */
export function suivreLaRegion(): void {
  appliquerLaRegion();
  useRegion.subscribe((etat, avant) => {
    if (etat.devise !== avant.devise || etat.temperature !== avant.temperature || etat.distance !== avant.distance) {
      appliquerLaRegion();
    }
  });
  useLangue.subscribe(() => {
    appliquerLaRegion();
    useRegion.setState((courant) => ({ version: courant.version + 1 }));
  });
}
