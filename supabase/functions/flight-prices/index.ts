import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { QuotaEpuise } from '../_shared/budget.ts';
import { PROVIDER, premierTarifConnu, tarifsDepuis, type TarifBrut } from '../_shared/travelpayouts.ts';

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
 *
 * Plusieurs aéroports de départ se comparent : ceux de la ville et de ses
 * voisines (de Lyon : Grenoble, Genève), ou ceux de tout un pays. Chacun coûte
 * un appel, gardé 24 h en cache et partagé par tous ; pour chaque destination,
 * on retient le moins cher, et on dit d'où il part.
 */

/** Au-delà, le relevé coûterait trop d'appels pour un gain minime. */
const ORIGINES_MAX = 8;

interface Demande {
  /** Les aéroports de départ à comparer, du plus naturel au plus lointain. */
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
  /** L'aéroport de départ de ce vol, quand plusieurs ont été comparés. */
  from?: string;
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

  const origines = [
    ...new Set((Array.isArray(demande.originIata) ? demande.originIata : []).filter(
      (code): code is string => typeof code === 'string' && /^[A-Z]{3}$/.test(code),
    )),
  ].slice(0, ORIGINES_MAX);
  if (origines.length === 0 || !Array.isArray(demande.destinations)) {
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

  try {
    // Un aéroport après l'autre : le premier épuisement du quota arrête tout,
    // et ce qui a déjà été relevé reste valable.
    const releves: { code: string; valeur: Record<string, TarifBrut> }[] = [];
    let provenance: string | undefined;
    let quotaEpuise = false;
    for (const code of origines) {
      try {
        const lecture = await tarifsDepuis(client, code, mois, token);
        releves.push({ code, valeur: lecture.valeur });
        provenance ??= lecture.origine;
      } catch (cause) {
        if (cause instanceof QuotaEpuise) {
          quotaEpuise = true;
          break;
        }
        // Un aéroport qui tousse ne prive pas des autres.
        console.error('flight-prices', code, cause);
      }
    }
    if (releves.length === 0 && quotaEpuise) throw new QuotaEpuise(PROVIDER);

    const releve = new Date().toISOString();
    const prices: Record<string, PrixReleve> = {};

    for (const destination of demande.destinations) {
      let tarif: TarifBrut | null = null;
      let depuis: string | undefined;
      for (const { code, valeur } of releves) {
        const ici = premierTarifConnu(valeur, destination.iata);
        if (ici && (!tarif || ici.prix < tarif.prix)) {
          tarif = ici;
          depuis = code;
        }
      }
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
        // Le départ n'est précisé que s'il y avait un choix.
        ...(releves.length > 1 && depuis ? { from: depuis } : {}),
      };
    }

    return json({
      prices,
      configured: true,
      origine: provenance,
      ...(quotaEpuise ? { quotaExceeded: true } : {}),
    });
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
