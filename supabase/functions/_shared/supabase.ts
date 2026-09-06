import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Client de service, réservé aux fonctions serveur.
 *
 * Il contourne la RLS par conception : c'est ce qui lui permet d'écrire dans
 * les tables techniques (cache, quotas) auxquelles aucun client n'a accès.
 * Sa clé ne quitte jamais l'environnement d'exécution des Edge Functions.
 */
export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Environnement Supabase incomplet');
  return createClient(url, key, { auth: { persistSession: false } });
}
