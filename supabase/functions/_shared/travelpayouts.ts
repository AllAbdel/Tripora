import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { avecCacheEtQuota } from './budget.ts';

/**
 * Le cache Aviasales de Travelpayouts, partagé par les fonctions qui en ont
 * besoin : `flight-prices` (les propositions d'un voyage) et
 * `surveiller-les-prix` (les alertes). Même clé de cache, même lecture : un
 * prix relevé pour l'un sert à l'autre, sans nouvel appel.
 */

export const PROVIDER = 'travelpayouts';
export const TTL_SECONDES = 24 * 60 * 60;
/** Très en dessous du raisonnable côté fournisseur : le cache fait le travail. */
export const LIMITES = { soft: 400, hard: 600 };

/** Les meilleurs prix depuis une ville, pour un mois (AAAA-MM) ou toute l'année. */
export function tarifsDepuis(
  client: SupabaseClient,
  origine: string,
  mois: string | null,
  token: string,
) {
  return avecCacheEtQuota<Record<string, TarifBrut>>({
    client,
    cle: `vols:${origine}:${mois ?? 'ouvert'}`,
    provider: PROVIDER,
    ttlSecondes: TTL_SECONDES,
    limites: LIMITES,
    appel: () => interrogerTravelpayouts(origine, mois, token),
  });
}

export interface TarifBrut {
  prix: number;
  departAt?: string;
  returnAt?: string;
  releveLe?: string;
  /**
   * `number_of_changes` de Travelpayouts : le nombre d'escales du vol auquel
   * ce prix correspond. On le remonte tel quel, parce qu'un prix d'appel avec
   * deux escales n'est pas le même voyage qu'un direct au même tarif.
   */
  escales?: number;
  /** `gate` : le site qui vendait, à distinguer de l'agrégateur. */
  agence?: string;
}

/**
 * Le nom du revendeur vaut-il la peine d'être montré ?
 *
 * Travelpayouts renvoie le champ `gate` dans la langue de son marché : un
 * relevé russe donne « Авиасейлс », qui est le même Aviasales que celui qu'on
 * cite déjà comme source. Afficher « vendu par Авиасейлс » à un francophone
 * n'apporte rien et fait douter du reste. On ne garde donc qu'un nom en
 * alphabet latin, et seulement s'il désigne quelqu'un d'autre que
 * l'agrégateur — sinon la phrase se répète pour ne rien dire.
 */
function nomDAgenceLisible(valeur: unknown): boolean {
  if (typeof valeur !== 'string') return false;
  const nom = valeur.trim();
  if (nom.length === 0 || nom.length > 60) return false;
  if (!/^[\p{Script=Latin}0-9 .,'&()/-]+$/u.test(nom)) return false;
  return nom.toLowerCase().replace(/[^a-z]/g, '') !== 'aviasales';
}

/**
 * Lecture tolérante de la réponse.
 *
 * Travelpayouts a plusieurs formats selon l'endpoint et l'époque : un tableau
 * d'objets, ou un dictionnaire indexé par code de destination. On accepte les
 * deux et on ignore en silence ce qui ne ressemble pas à un tarif, plutôt que
 * de tout perdre sur un champ inattendu.
 */
function lireTarifs(charge: unknown): Record<string, TarifBrut> {
  const sortie: Record<string, TarifBrut> = {};

  const noter = (code: unknown, valeur: unknown) => {
    if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return;
    if (typeof valeur !== 'object' || valeur === null) return;
    const entree = valeur as Record<string, unknown>;
    const prix = Number(entree.value ?? entree.price);
    if (!Number.isFinite(prix) || prix <= 0) return;
    const existant = sortie[code];
    if (existant && existant.prix <= prix) return;
    const escales = Number(entree.number_of_changes ?? entree.transfers);
    sortie[code] = {
      prix,
      ...(typeof entree.depart_date === 'string' ? { departAt: entree.depart_date } : {}),
      ...(typeof entree.return_date === 'string' ? { returnAt: entree.return_date } : {}),
      ...(typeof entree.found_at === 'string' ? { releveLe: entree.found_at } : {}),
      ...(Number.isInteger(escales) && escales >= 0 && escales <= 5 ? { escales } : {}),
      ...(nomDAgenceLisible(entree.gate) ? { agence: entree.gate as string } : {}),
    };
  };

  const data = (charge as { data?: unknown })?.data;

  if (Array.isArray(data)) {
    for (const entree of data) {
      noter((entree as { destination?: unknown })?.destination, entree);
    }
    return sortie;
  }

  if (typeof data === 'object' && data !== null) {
    for (const [code, valeur] of Object.entries(data)) {
      // Format v1 : { "BUD": { "0": {...}, "1": {...} } }
      if (valeur && typeof valeur === 'object' && !('value' in valeur) && !('price' in valeur)) {
        for (const sous of Object.values(valeur as Record<string, unknown>)) noter(code, sous);
      } else {
        noter(code, valeur);
      }
    }
  }

  return sortie;
}

export async function interrogerTravelpayouts(
  origine: string,
  mois: string | null,
  token: string,
): Promise<Record<string, TarifBrut>> {
  const url = new URL('https://api.travelpayouts.com/v2/prices/latest');
  url.searchParams.set('currency', 'eur');
  url.searchParams.set('origin', origine);
  url.searchParams.set('one_way', 'false');
  url.searchParams.set('group_by', 'directions');
  url.searchParams.set('limit', '1000');
  url.searchParams.set('sorting', 'price');
  if (mois) {
    url.searchParams.set('period_type', 'month');
    url.searchParams.set('beginning_of_period', `${mois}-01`);
  } else {
    url.searchParams.set('period_type', 'year');
  }

  const reponse = await fetch(url, {
    headers: { 'X-Access-Token': token, Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!reponse.ok) {
    throw new Error(`Travelpayouts a répondu ${reponse.status}`);
  }
  const tarifs = lireTarifs(await reponse.json());

  // Une réponse vide sur un mois précis n'est pas une panne : cette période
  // n'a simplement pas encore été cherchée par assez de monde. On retente en
  // période ouverte plutôt que de ne rien afficher.
  if (Object.keys(tarifs).length === 0 && mois) {
    return interrogerTravelpayouts(origine, null, token);
  }
  return tarifs;
}

/** Première correspondance parmi les codes connus pour une destination. */
export function premierTarifConnu(
  tarifs: Record<string, TarifBrut>,
  codes: string[],
): TarifBrut | null {
  let meilleur: TarifBrut | null = null;
  for (const code of codes) {
    const tarif = tarifs[code];
    if (tarif && (!meilleur || tarif.prix < meilleur.prix)) meilleur = tarif;
  }
  return meilleur;
}
