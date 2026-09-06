import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { avecCacheEtQuota, QuotaEpuise } from '../_shared/budget.ts';

/**
 * Les taux de change, et rien d'autre.
 *
 * Source : Frankfurter, qui republie les taux de référence de la Banque
 * centrale européenne. Gratuit, sans clé, sans quota, sans compte à créer —
 * la meilleure source possible pour ce projet, et une source *officielle*,
 * ce qui compte quand il s'agit de dire à un ami combien il doit.
 *
 * Deux choses que cette fonction ne fait pas :
 *
 *  - elle ne convertit rien. Elle sert la table des taux ; la conversion se
 *    fait dans `@tripora/core`, où elle est testée, et le taux employé est
 *    figé dans la dépense pour qu'un compte passé ne bouge jamais ;
 *  - elle ne prétend pas que les taux sont d'aujourd'hui. La BCE ne publie ni
 *    le week-end ni les jours fériés : la date renvoyée est celle de la
 *    publication, et l'écran l'affiche telle quelle.
 *
 * La BCE publie une trentaine de devises. Le dirham marocain, le dinar serbe
 * et le lek albanais n'en font pas partie : pour ces destinations Tripora
 * annonce qu'il ne sait pas convertir, au lieu d'aller chercher un taux
 * douteux ailleurs.
 */

/** Publication vers 16 h CET les jours ouvrés : quatre appels par jour suffisent. */
const TTL_SECONDES = 6 * 60 * 60;
const LIMITES = { soft: 200, hard: 400 };
const SOURCE = 'https://api.frankfurter.dev/v1/latest';

interface Taux {
  base: string;
  date: string;
  rates: Record<string, number>;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  const client = serviceClient();

  try {
    const { valeur, origine } = await avecCacheEtQuota<Taux>({
      client,
      cle: 'fx:eur',
      provider: 'frankfurter',
      ttlSecondes: TTL_SECONDES,
      limites: LIMITES,
      appel: recupererTaux,
    });

    // Trace datée, pour qu'un désaccord sur une dépense se tranche en
    // comparant le taux figé dans la ligne au taux publié ce jour-là.
    if (origine === 'reseau') await archiver(client, valeur);

    return json({ ...valeur, stale: origine === 'cache-perime' });
  } catch (cause) {
    if (cause instanceof QuotaEpuise) {
      return json({ unavailable: true, reason: 'quota' }, 200);
    }
    console.error('fx', cause);
    return json({ unavailable: true, reason: 'source' }, 200);
  }
});

async function recupererTaux(): Promise<Taux> {
  const reponse = await fetch(SOURCE, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!reponse.ok) throw new Error(`Frankfurter ${reponse.status}`);

  const brut = (await reponse.json()) as Partial<Taux>;
  if (typeof brut.date !== 'string' || typeof brut.rates !== 'object' || !brut.rates) {
    throw new Error('Réponse Frankfurter inattendue');
  }

  // On ne garde que des taux exploitables : un zéro ou un NaN qui passerait
  // jusqu'au client produirait une division par zéro dans la conversion.
  const rates: Record<string, number> = {};
  for (const [code, taux] of Object.entries(brut.rates)) {
    if (typeof taux === 'number' && Number.isFinite(taux) && taux > 0) {
      rates[code.toUpperCase()] = taux;
    }
  }
  if (Object.keys(rates).length === 0) throw new Error('Aucun taux exploitable');

  return { base: (brut.base ?? 'EUR').toUpperCase(), date: brut.date, rates };
}

async function archiver(
  client: ReturnType<typeof serviceClient>,
  taux: Taux,
): Promise<void> {
  const lignes = Object.entries(taux.rates).map(([quote, rate]) => ({
    base: taux.base,
    quote,
    rate,
    day: taux.date,
  }));
  const { error } = await client.from('fx_rates').upsert(lignes, {
    onConflict: 'base,quote,day',
  });
  // L'archive est un confort, pas une dépendance : si elle échoue, les taux
  // partent quand même.
  if (error) console.warn('fx: archive impossible', error.message);
}
