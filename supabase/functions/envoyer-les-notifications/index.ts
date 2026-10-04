import { preflight, json } from '../_shared/cors.ts';
import { serviceClient } from '../_shared/supabase.ts';
import { clesVapid } from '../_shared/clesVapid.ts';
import { envoyer, type AbonnementPush } from '../_shared/push.ts';

/**
 * L'envoi des notifications du groupe.
 *
 * La base met en file ce qui se passe dans les voyages (migration des
 * notifications du groupe) ; pg_cron appelle cette fonction toutes les
 * minutes quand la file n'est pas vide. Pour chaque ligne : le contenu, chiffré
 * pour chaque appareil de la personne (RFC 8291), puis remis au service de
 * notification de son navigateur. Le service worker de Tripora le met en mots,
 * dans la langue de l'interface (`public/sw-alertes.js`).
 *
 * Une ligne est d'abord « réservée » (envoye_le posé là où il était vide) :
 * deux appels qui se chevauchent n'envoient jamais deux fois la même chose.
 * Une fois partie, elle perd son contenu.
 */

const CONTACT = 'https://tripora-3rg.pages.dev/mentions-legales';
const PAR_PASSAGE = 300;

interface Ligne {
  id: number;
  destinataire: string;
  trip_id: string | null;
  genre: string;
  donnees: Record<string, unknown>;
}

interface Abonnement extends AbonnementPush {
  id: string;
  user_id: string;
}

/** Un message qui attend une heure n'apprend plus rien ; une décision, si. */
const DUREE_DE_VIE: Record<string, number> = {
  message: 6 * 60 * 60,
  tous_ont_vote: 3 * 24 * 60 * 60,
  destination: 3 * 24 * 60 * 60,
};

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;

  const client = serviceClient();
  const cles = await clesVapid(client);
  if (!cles) return json({ envoyees: 0, raison: 'clés indisponibles' });

  const { data: enAttente, error } = await client
    .from('notifications_a_envoyer')
    .select('id')
    .is('envoye_le', null)
    .order('id', { ascending: true })
    .limit(PAR_PASSAGE);
  if (error) {
    console.error('envoyer-les-notifications', error);
    return json({ error: 'lecture de la file' }, 500);
  }
  if (!enAttente || enAttente.length === 0) return json({ envoyees: 0 });

  // La réservation : seules les lignes encore libres reviennent.
  const { data: reservees, error: erreurReservation } = await client
    .from('notifications_a_envoyer')
    .update({ envoye_le: new Date().toISOString() })
    .in('id', enAttente.map((ligne) => ligne.id as number))
    .is('envoye_le', null)
    .select('id, destinataire, trip_id, genre, donnees');
  if (erreurReservation) {
    console.error('envoyer-les-notifications', erreurReservation);
    return json({ error: 'réservation de la file' }, 500);
  }
  const lignes = (reservees ?? []) as Ligne[];

  const destinataires = [...new Set(lignes.map((ligne) => ligne.destinataire))];
  const { data: abonnements } = await client
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', destinataires.length > 0 ? destinataires : ['00000000-0000-0000-0000-000000000000']);
  const parPersonne = new Map<string, Abonnement[]>();
  for (const abonnement of (abonnements ?? []) as Abonnement[]) {
    parPersonne.set(abonnement.user_id, [...(parPersonne.get(abonnement.user_id) ?? []), abonnement]);
  }

  let envoyees = 0;
  const perimes = new Set<string>();
  for (const ligne of lignes) {
    const contenu = { genre: ligne.genre, voyageId: ligne.trip_id, ...ligne.donnees };
    for (const abonnement of parPersonne.get(ligne.destinataire) ?? []) {
      if (perimes.has(abonnement.id)) continue;
      try {
        const resultat = await envoyer(abonnement, contenu, cles, CONTACT, {
          ttl: DUREE_DE_VIE[ligne.genre] ?? 24 * 60 * 60,
          urgence: ligne.genre === 'message' ? 'high' : 'normal',
        });
        if (resultat === 'envoye') envoyees += 1;
        // Un navigateur désinstallé ou une permission retirée : on oublie.
        if (resultat === 'perime') perimes.add(abonnement.id);
      } catch (cause) {
        console.warn('envoyer-les-notifications', cause instanceof Error ? cause.message : cause);
      }
    }
  }

  if (perimes.size > 0) await client.from('push_subscriptions').delete().in('id', [...perimes]);
  // Le contenu ne sert plus : seule la clé reste, pour ne pas prévenir deux fois.
  if (lignes.length > 0) {
    await client
      .from('notifications_a_envoyer')
      .update({ donnees: {} })
      .in('id', lignes.map((ligne) => ligne.id));
  }

  return json({ envoyees, lignes: lignes.length, abonnementsOublies: perimes.size });
});
