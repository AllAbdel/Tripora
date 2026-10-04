import { queryOptions } from '@tanstack/react-query';
import { supabase } from './supabase';

/**
 * Les notifications du groupe : ce qui se passe dans les voyages (un message,
 * une dépense, une arrivée, une décision), prévenu sur les appareils abonnés.
 *
 * Tout se décide côté serveur (migration des notifications du groupe) : la
 * base met en file, la fonction `envoyer-les-notifications` chiffre et
 * envoie, le service worker met en mots (`public/sw-alertes.js`). Le client
 * ne fait que deux choses : abonner cet appareil (le même abonnement que les
 * alertes de prix, `alertesDePrix.ts`) et régler, catégorie par catégorie, ce
 * qu'on veut recevoir.
 */

export type CategorieDeNotification = 'discussion' | 'depenses' | 'decisions' | 'groupe';
export type ReglagesDeNotification = Record<CategorieDeNotification, boolean>;

export const REGLAGES_PAR_DEFAUT: ReglagesDeNotification = {
  discussion: true,
  depenses: true,
  decisions: true,
  groupe: true,
};

export const CATEGORIES: readonly { cle: CategorieDeNotification; titre: string; detail: string }[] = [
  { cle: 'discussion', titre: 'La discussion', detail: 'Les nouveaux messages, regroupés quand ils arrivent ensemble.' },
  { cle: 'depenses', titre: 'Les dépenses', detail: 'Quand quelqu’un ajoute une dépense que vous partagez.' },
  {
    cle: 'decisions',
    titre: 'Les décisions',
    detail: 'Un sondage lancé, la destination arrêtée et, pour l’organisateur, tout le monde qui a voté.',
  },
  {
    cle: 'groupe',
    titre: 'Le groupe',
    detail: 'Une arrivée, une tâche qu’on vous confie, et le rappel de vos envies quand le groupe les attend.',
  },
];

/**
 * `null` : le serveur ne connaît pas encore les notifications du groupe (la
 * migration n'est pas passée) ; l'écran n'en parle alors pas du tout.
 */
export async function lireMesReglages(): Promise<ReglagesDeNotification | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('reglages_de_notification')
    .select('discussion, depenses, decisions, groupe')
    .maybeSingle();
  if (error) {
    if (tableAbsente(error)) return null;
    throw error;
  }
  return reglagesDepuisLaBase(data);
}

export async function enregistrerMesReglages(reglages: ReglagesDeNotification): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const moi = data.session?.user.id;
  if (!moi) throw new Error('Connexion requise pour régler les notifications.');
  const { error } = await supabase
    .from('reglages_de_notification')
    .upsert({ user_id: moi, ...reglages, modifie_le: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Une ligne absente, c'est tout ouvert ; une valeur douteuse aussi. */
export function reglagesDepuisLaBase(ligne: Partial<Record<CategorieDeNotification, unknown>> | null): ReglagesDeNotification {
  const lu = (cle: CategorieDeNotification) => (typeof ligne?.[cle] === 'boolean' ? (ligne[cle] as boolean) : true);
  return { discussion: lu('discussion'), depenses: lu('depenses'), decisions: lu('decisions'), groupe: lu('groupe') };
}

/** La table n'existe pas (encore) : PostgREST ne la trouve pas dans son schéma. */
function tableAbsente(erreur: { code?: string }): boolean {
  return erreur.code === 'PGRST205' || erreur.code === '42P01';
}

export const CLE_DES_REGLAGES = ['reglages-de-notification'] as const;

export function requeteDesReglages(actif = true) {
  return queryOptions({
    queryKey: CLE_DES_REGLAGES,
    queryFn: lireMesReglages,
    enabled: Boolean(supabase) && actif,
    staleTime: 10 * 60 * 1000,
  });
}
