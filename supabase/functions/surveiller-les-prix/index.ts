import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { QuotaEpuise } from '../_shared/budget.ts';
import { premierTarifConnu, tarifsDepuis, type TarifBrut } from '../_shared/travelpayouts.ts';
import { clesVapid } from '../_shared/clesVapid.ts';
import { baisseASignaler, reveiller, type ClesVapid } from './push.ts';

/**
 * Le relevé du matin des prix suivis.
 *
 * Appelée chaque jour par pg_cron (voir la migration des alertes de prix), et
 * aussi par l'application pour récupérer la clé publique des notifications.
 *
 * Pour chaque suivi qui n'a pas été relevé depuis vingt heures : le prix du
 * trajet dans le cache Aviasales (une requête par ville de départ et par mois,
 * partagée avec les propositions des voyages), puis, si le prix a vraiment
 * baissé, une alerte écrite et les navigateurs de la personne réveillés.
 *
 * Rien n'est fait deux fois : appelée plusieurs fois dans la journée, la
 * fonction ne trouve plus rien à relever et répond aussitôt.
 */

const CONTACT = 'https://tripora-3rg.pages.dev/mentions-legales';
const PAR_PASSAGE = 200;
const DELAI_HEURES = 20;

interface Suivi {
  id: string;
  user_id: string;
  origin_iata: string;
  destination_iata: string[];
  month: string;
  first_cents: number | null;
  lowest_cents: number | null;
  notified_cents: number | null;
}

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  const client = serviceClient();
  const cles = await clesVapid(client);

  const token = Deno.env.get('TRAVELPAYOUTS_TOKEN');
  if (!token) return json({ configured: false, releves: 0 });

  // Les mois passés ne s'achètent plus : on les oublie, alertes comprises
  // (cascade). Un suivi n'a plus rien à dire une fois le voyage parti.
  const moisCourant = new Date().toISOString().slice(0, 7);
  await client.from('price_watches').delete().lt('month', moisCourant);
  const limite = new Date(Date.now() - DELAI_HEURES * 3600_000).toISOString();
  const { data, error } = await client
    .from('price_watches')
    .select('id, user_id, origin_iata, destination_iata, month, first_cents, lowest_cents, notified_cents')
    .gte('month', moisCourant)
    .or(`checked_at.is.null,checked_at.lt.${limite}`)
    .order('checked_at', { ascending: true, nullsFirst: true })
    .limit(PAR_PASSAGE);
  if (error) {
    console.error('surveiller-les-prix', error);
    return json({ error: 'lecture des suivis' }, 500);
  }
  const suivis = (data ?? []) as Suivi[];

  // Une requête par ville de départ et par mois, quel que soit le nombre de
  // personnes qui suivent un trajet depuis cette ville.
  const groupes = new Map<string, Suivi[]>();
  for (const suivi of suivis) {
    const cle = `${suivi.origin_iata}|${suivi.month}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), suivi]);
  }

  let releves = 0;
  let alertes = 0;
  const aReveiller = new Set<string>();

  for (const [cle, membres] of groupes) {
    const [origine, mois] = cle.split('|') as [string, string];
    let tarifs: Record<string, TarifBrut>;
    try {
      tarifs = (await tarifsDepuis(client, origine, mois, token)).valeur;
    } catch (cause) {
      if (cause instanceof QuotaEpuise) break;
      console.warn('surveiller-les-prix', origine, mois, cause);
      continue;
    }

    for (const suivi of membres) {
      const tarif = premierTarifConnu(tarifs, suivi.destination_iata);
      const maintenant = new Date().toISOString();
      if (!tarif) {
        await client.from('price_watches').update({ checked_at: maintenant }).eq('id', suivi.id);
        continue;
      }
      const cents = Math.round(tarif.prix * 100);
      const reference = suivi.notified_cents ?? suivi.first_cents;
      const signaler = baisseASignaler(reference, cents);
      await client
        .from('price_watches')
        .update({
          checked_at: maintenant,
          last_cents: cents,
          first_cents: suivi.first_cents ?? cents,
          lowest_cents: Math.min(suivi.lowest_cents ?? cents, cents),
          ...(signaler ? { notified_cents: cents } : {}),
        })
        .eq('id', suivi.id);
      releves += 1;

      if (signaler && reference !== null) {
        const { error: ecriture } = await client
          .from('price_alerts')
          .insert({ watch_id: suivi.id, user_id: suivi.user_id, old_cents: reference, new_cents: cents });
        if (!ecriture) {
          alertes += 1;
          aReveiller.add(suivi.user_id);
        }
      }
    }
  }

  const envoyees = cles ? await reveillerLesAbonnes(client, cles, [...aReveiller]) : 0;
  return json({ configured: true, releves, alertes, notifications: envoyees });
});

async function reveillerLesAbonnes(
  client: ReturnType<typeof serviceClient>,
  cles: ClesVapid,
  personnes: string[],
): Promise<number> {
  if (personnes.length === 0) return 0;
  const { data } = await client
    .from('push_subscriptions')
    .select('id, endpoint')
    .in('user_id', personnes);
  let envoyees = 0;
  for (const abonnement of (data ?? []) as { id: string; endpoint: string }[]) {
    try {
      const resultat = await reveiller(abonnement.endpoint, cles, CONTACT);
      if (resultat === 'envoye') envoyees += 1;
      // Un navigateur désinstallé ou une permission retirée : on oublie.
      if (resultat === 'perime') await client.from('push_subscriptions').delete().eq('id', abonnement.id);
    } catch (cause) {
      console.warn('surveiller-les-prix push', cause instanceof Error ? cause.message : cause);
    }
  }
  return envoyees;
}
