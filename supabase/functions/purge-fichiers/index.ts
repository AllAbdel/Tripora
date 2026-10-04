import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';

/**
 * Efface du stockage les documents des voyages purgés.
 *
 * `purger_les_voyages_supprimes()` (voir la migration 20260925090000) efface
 * chaque nuit les voyages supprimés depuis plus de trente jours, et note les
 * chemins de leurs documents dans `fichiers_a_effacer`. Effacer ces fichiers
 * en SQL ne retirerait que leur fiche : le fichier resterait sur le disque.
 * Seule l'API de stockage l'efface vraiment, et c'est ce que fait cette
 * fonction, appelée par pg_cron vingt minutes après la purge.
 *
 * Elle ne prend rien en entrée et ne rend que des comptes : l'appeler plus
 * souvent ne fait qu'effacer plus tôt ce qui devait l'être.
 */

const PAR_PASSAGE = 500;

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  const client = serviceClient();
  const { data, error } = await client
    .from('fichiers_a_effacer')
    .select('bucket, chemin')
    .order('depuis')
    .limit(PAR_PASSAGE);
  if (error) {
    console.error('purge-fichiers : lecture', error);
    return json({ error: 'Lecture impossible' }, 500);
  }

  const parBucket = new Map<string, string[]>();
  for (const { bucket, chemin } of data ?? []) {
    parBucket.set(bucket, [...(parBucket.get(bucket) ?? []), chemin]);
  }

  let effaces = 0;
  for (const [bucket, chemins] of parBucket) {
    // Un chemin déjà absent du stockage ne fait pas échouer l'appel : il est
    // simplement retiré de la liste avec les autres.
    const { error: echec } = await client.storage.from(bucket).remove(chemins);
    if (echec) {
      console.error('purge-fichiers : effacement', bucket, echec);
      continue;
    }
    const { error: oubli } = await client
      .from('fichiers_a_effacer')
      .delete()
      .eq('bucket', bucket)
      .in('chemin', chemins);
    if (oubli) console.error('purge-fichiers : liste', bucket, oubli);
    else effaces += chemins.length;
  }

  return json({ effaces, restants: (data?.length ?? 0) - effaces });
});
