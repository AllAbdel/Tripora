import { CURRENCIES, isConvertible, type Currency, type FxRates } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Les taux de change du jour.
 *
 * Un seul appel par personne et par jour : la table entière arrive d'un coup
 * et la conversion se fait ensuite dans le navigateur, instantanément, pendant
 * que la personne tape son montant. Le cache de TanStack Query est persisté,
 * donc les derniers taux connus survivent à une coupure réseau — avec leur
 * date, qui est affichée, parce qu'un taux périmé qu'on annonce vaut mieux
 * qu'un taux périmé qu'on cache.
 *
 * Sans Supabase, il n'y a pas de taux : l'écran des dépenses reste en euros et
 * ne propose simplement pas de devise. Rien ne casse.
 */

export type EtatTaux =
  | { statut: 'ok'; taux: FxRates; perime: boolean }
  | { statut: 'indisponible' };

interface ReponseBrute {
  base?: unknown;
  date?: unknown;
  rates?: unknown;
  stale?: unknown;
  unavailable?: unknown;
}

export async function chargerTaux(): Promise<EtatTaux> {
  if (!supabase) return { statut: 'indisponible' };
  try {
    const { data, error } = await supabase.functions.invoke('fx', { body: {} });
    if (error || !data) return { statut: 'indisponible' };

    const reponse = data as ReponseBrute;
    if (reponse.unavailable) return { statut: 'indisponible' };
    if (typeof reponse.date !== 'string' || typeof reponse.rates !== 'object' || !reponse.rates) {
      return { statut: 'indisponible' };
    }

    // Le serveur filtre déjà, mais ce qui entre dans un calcul d'argent est
    // revérifié ici : un taux nul provoquerait une division par zéro.
    const rates: Record<string, number> = {};
    for (const [code, valeur] of Object.entries(reponse.rates as Record<string, unknown>)) {
      if (typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0) {
        rates[code.toUpperCase()] = valeur;
      }
    }
    if (Object.keys(rates).length === 0) return { statut: 'indisponible' };

    return {
      statut: 'ok',
      taux: { base: typeof reponse.base === 'string' ? reponse.base : 'EUR', date: reponse.date, rates },
      perime: reponse.stale === true,
    };
  } catch {
    return { statut: 'indisponible' };
  }
}

/** Clé de cache stable : les taux sont les mêmes pour tout le monde. */
export const CLE_TAUX = ['fx', 'eur'] as const;

/**
 * Les devises à proposer dans le formulaire, dans l'ordre où elles servent.
 *
 * Celle du pays de destination d'abord — c'est celle qu'on tend au serveur —
 * puis l'euro, puis les autres par ordre alphabétique du catalogue. Sans taux
 * du jour, une seule entrée : l'euro. Mieux vaut un écran monodevise qu'une
 * conversion faite avec un taux qu'on n'a pas.
 */
export function devisesProposees(
  taux: FxRates | null,
  deviseLocale: string | undefined,
): Currency[] {
  const euro = CURRENCIES.filter((devise) => devise.code === 'EUR');
  if (!taux) return euro;

  const disponibles = CURRENCIES.filter(
    (devise) => devise.code === 'EUR' || typeof taux.rates[devise.code] === 'number',
  );
  const tete =
    deviseLocale && deviseLocale !== 'EUR' && isConvertible(deviseLocale) ? [deviseLocale] : [];
  const ordre = [...tete, 'EUR'];
  return [
    ...ordre.flatMap((code) => disponibles.filter((devise) => devise.code === code)),
    ...disponibles.filter((devise) => !ordre.includes(devise.code)),
  ];
}
