import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';

/**
 * Prix de vols relevés, via le cache Aviasales de Travelpayouts.
 *
 * Ce ne sont pas des tarifs en direct : ce sont les moins chers réellement
 * trouvés par de vrais utilisateurs ces derniers jours. L'application le dit
 * toujours (« prix vu le … »), et déclasse en « indicatif » au-delà de 72 h.
 *
 * Un seul appel réseau couvre toutes les destinations : l'endpoint « latest »
 * groupé par direction renvoie le meilleur prix depuis une ville vers chaque
 * destination connue. Vingt destinations coûtent donc une requête, pas vingt.
 *
 * Le jeton ne quitte jamais cette fonction. Sans lui, on répond poliment que
 * les prix ne sont pas disponibles : l'application retombe alors sur ses
 * estimations, qui sont étiquetées comme telles.
 */

const PROVIDER = 'travelpayouts';
const TTL_SECONDES = 24 * 60 * 60;
/** Très en dessous du raisonnable côté fournisseur : le cache fait le travail. */
const LIMITES = { soft: 400, hard: 600 };

interface Demande {
  originIata: string[];
  /** Mois visé au format AAAA-MM. Absent : période ouverte. */
  month?: string;
  /** Codes IATA acceptés pour chaque destination du catalogue. */
  destinations: { id: string; iata: string[] }[];
}

interface PrixReleve {
  cents: number;
  source: 'observed';
  provider: 'Aviasales';
  fetchedAt: string;
  departAt?: string;
  returnAt?: string;
  /** Nombre de changements du vol relevé. Absent quand la source se tait. */
  stops?: number;
  /** L'agence qui vendait à ce prix : Aviasales agrège, elle ne vend pas. */
  reseller?: string;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  let demande: Demande;
  try {
    demande = await request.json();
  } catch {
    return json({ error: 'Corps de requête illisible' }, 400);
  }

  const origine = (demande.originIata ?? []).find((code) => /^[A-Z]{3}$/.test(code));
  if (!origine || !Array.isArray(demande.destinations)) {
    return json({ error: 'Origine ou destinations manquantes' }, 400);
  }

  const token = Deno.env.get('TRAVELPAYOUTS_TOKEN');
  if (!token) {
    // Cas normal tant que le jeton n'est pas renseigné : ce n'est pas une
    // erreur, c'est une fonctionnalité qui n'est pas encore branchée.
    return json({ prices: {}, configured: false });
  }

  const client = serviceClient();
  const mois = /^\d{4}-\d{2}$/.test(demande.month ?? '') ? demande.month! : null;
  const cle = `vols:${origine}:${mois ?? 'ouvert'}`;

  try {
    const { valeur, origine: provenance } = await avecCacheEtQuota<Record<string, TarifBrut>>({
      client,
      cle,
      provider: PROVIDER,
      ttlSecondes: TTL_SECONDES,
      limites: LIMITES,
      appel: () => interrogerTravelpayouts(origine, mois, token),
    });

    const releve = new Date().toISOString();
    const prices: Record<string, PrixReleve> = {};

    for (const destination of demande.destinations) {
      const tarif = premierTarifConnu(valeur, destination.iata);
      if (!tarif) continue;
      prices[destination.id] = {
        cents: Math.round(tarif.prix * 100),
        source: 'observed',
        provider: 'Aviasales',
        // Le cache garde la date du relevé, pas celle de la lecture.
        fetchedAt: tarif.releveLe ?? releve,
        ...(tarif.departAt ? { departAt: tarif.departAt } : {}),
        ...(tarif.returnAt ? { returnAt: tarif.returnAt } : {}),
        ...(tarif.escales === undefined ? {} : { stops: tarif.escales }),
        ...(tarif.agence ? { reseller: tarif.agence } : {}),
      };
    }

    return json({ prices, configured: true, origine: provenance });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) {
      return json(
        { prices: {}, configured: true, quotaExceeded: true, provider: PROVIDER },
        200,
      );
    }
    console.error('flight-prices', cause);
    // On ne casse jamais l'écran pour un fournisseur qui tousse : sans prix
    // relevé, l'application affiche ses estimations.
    return json({ prices: {}, configured: true, failed: true }, 200);
  }
});

interface TarifBrut {
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
 * Lecture tolérante de la réponse.
 *
 * Travelpayouts a plusieurs formats selon l'endpoint et l'époque : un tableau
 * d'objets, ou un dictionnaire indexé par code de destination. On accepte les
 * deux et on ignore en silence ce qui ne ressemble pas à un tarif, plutôt que
 * de tout perdre sur un champ inattendu.
 */
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

async function interrogerTravelpayouts(
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
function premierTarifConnu(
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
