import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { creerClesVapid, type ClesVapid } from './push.ts';

/**
 * La paire VAPID de Tripora, créée au premier passage et gardée côté serveur
 * (table `cles_push`, fermée aux clients). Partagée par les alertes de prix et
 * les notifications du groupe : un navigateur abonné une fois les reçoit
 * toutes.
 */
export async function clesVapid(client: SupabaseClient): Promise<ClesVapid | null> {
  const { data } = await client.from('cles_push').select('publique, privee').eq('id', 1).maybeSingle();
  if (data) return { publique: data.publique as string, privee: data.privee as JsonWebKey };
  const cles = await creerClesVapid();
  // Deux appels simultanés : le second échoue sur la clé primaire et relit.
  const { error } = await client.from('cles_push').insert({ id: 1, publique: cles.publique, privee: cles.privee });
  if (!error) return cles;
  const { data: relue } = await client.from('cles_push').select('publique, privee').eq('id', 1).maybeSingle();
  return relue ? { publique: relue.publique as string, privee: relue.privee as JsonWebKey } : null;
}
