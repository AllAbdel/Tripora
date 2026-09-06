import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Cache partagé et garde-quota.
 *
 * C'est la pièce qui rend Tripora soutenable gratuitement. Deux idées :
 *
 *  1. Une réponse sert tout le monde. Cinq personnes qui ouvrent le même
 *     voyage ne déclenchent qu'un seul appel.
 *  2. On s'arrête avant la limite du fournisseur, pas après. Au-delà d'un
 *     seuil doux on ne sert plus que le cache, même périmé ; à la limite dure
 *     on refuse franchement, avec la date de reprise. Une facture reste
 *     impossible de toute façon — aucun moyen de paiement n'est enregistré —
 *     mais un quota épuisé couperait la fonction pour tout le groupe.
 */

export class QuotaEpuise extends Error {
  constructor(public readonly provider: string) {
    super(`Quota gratuit épuisé pour ${provider}`);
    this.name = 'QuotaEpuise';
  }
}

export interface Limites {
  /** Au-delà : cache uniquement. */
  soft: number;
  /** Au-delà : refus. */
  hard: number;
}

export async function lireCache<T>(
  client: SupabaseClient,
  cle: string,
): Promise<{ valeur: T; fraiche: boolean } | null> {
  const { data } = await client
    .from('api_cache')
    .select('payload, expires_at')
    .eq('key', cle)
    .maybeSingle();
  if (!data) return null;
  return {
    valeur: data.payload as T,
    fraiche: new Date(data.expires_at as string).getTime() > Date.now(),
  };
}

export async function ecrireCache(
  client: SupabaseClient,
  cle: string,
  provider: string,
  payload: unknown,
  ttlSecondes: number,
): Promise<void> {
  await client.from('api_cache').upsert(
    {
      key: cle,
      provider,
      payload,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlSecondes * 1000).toISOString(),
    },
    { onConflict: 'key' },
  );
}

/** Incrémente le compteur du jour et dit ce qu'on a encore le droit de faire. */
export async function consommerQuota(
  client: SupabaseClient,
  provider: string,
  limites: Limites,
): Promise<'ok' | 'cache-seulement' | 'epuise'> {
  const { data, error } = await client.rpc('bump_api_quota', {
    p_provider: provider,
    p_soft: limites.soft,
    p_hard: limites.hard,
  });
  // Un compteur en panne ne doit pas bloquer l'application : on laisse passer,
  // la limite du fournisseur reste le dernier garde-fou.
  if (error) return 'ok';
  const ligne = Array.isArray(data) ? data[0] : data;
  const utilise = Number(ligne?.used ?? 0);
  if (utilise > limites.hard) return 'epuise';
  if (utilise > limites.soft) return 'cache-seulement';
  return 'ok';
}

/**
 * Récupère une valeur : cache frais, sinon appel réel, sinon cache périmé.
 * Ne lève que si tout a échoué et qu'il n'y a rien à servir.
 */
export async function avecCacheEtQuota<T>({
  client,
  cle,
  provider,
  ttlSecondes,
  limites,
  appel,
}: {
  client: SupabaseClient;
  cle: string;
  provider: string;
  ttlSecondes: number;
  limites: Limites;
  appel: () => Promise<T>;
}): Promise<{ valeur: T; origine: 'cache' | 'reseau' | 'cache-perime' }> {
  const cache = await lireCache<T>(client, cle);
  if (cache?.fraiche) return { valeur: cache.valeur, origine: 'cache' };

  const autorisation = await consommerQuota(client, provider, limites);
  if (autorisation !== 'ok') {
    if (cache) return { valeur: cache.valeur, origine: 'cache-perime' };
    throw new QuotaEpuise(provider);
  }

  try {
    const valeur = await appel();
    await ecrireCache(client, cle, provider, valeur, ttlSecondes);
    return { valeur, origine: 'reseau' };
  } catch (cause) {
    // Un fournisseur qui tousse ne doit pas effacer ce qu'on savait déjà.
    if (cache) return { valeur: cache.valeur, origine: 'cache-perime' };
    throw cause;
  }
}
