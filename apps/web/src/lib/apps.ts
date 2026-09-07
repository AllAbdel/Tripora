import type { ApplicationUtile, CategorieApp } from '@tripora/core';
import { supabase } from './supabase';

/**
 * Le catalogue d'applications recommandées, et sa modération.
 *
 * Deux lectures très différentes partagent la même table :
 *
 *  - **tout le monde** lit les fiches publiées, une fois, et les garde en
 *    cache — le catalogue bouge de quelques lignes par mois, pas par minute ;
 *  - **l'administrateur** lit en plus ce qui attend, et tranche.
 *
 * Le tri et le filtrage par destination ne sont pas ici mais dans
 * `@tripora/core` : ce module ne fait que transporter des lignes. Le serveur
 * n'a pas à savoir où part le voyage pour répondre, et l'écran n'a pas à
 * refaire un appel réseau chaque fois que le groupe change de destination.
 */

export interface PropositionApp {
  name: string;
  category: CategorieApp;
  tagline: string;
  why: string;
  caveat?: string | null;
  iosUrl?: string | null;
  androidUrl?: string | null;
  webUrl?: string | null;
  countryCodes?: readonly string[];
  destinationIds?: readonly string[];
}

export type StatutApp = 'pending' | 'published' | 'rejected';

export interface ApplicationEnAttente extends ApplicationUtile {
  status: StatutApp;
  submittedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

const COLONNES =
  'id, name, category, tagline, why, caveat, ios_url, android_url, web_url, ' +
  'country_codes, destination_ids, priority, status, submitted_by, review_note, created_at';

function versApplication(row: Record<string, unknown>): ApplicationEnAttente {
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    category: row['category'] as CategorieApp,
    tagline: row['tagline'] as string,
    why: row['why'] as string,
    caveat: (row['caveat'] as string | null) ?? null,
    iosUrl: (row['ios_url'] as string | null) ?? null,
    androidUrl: (row['android_url'] as string | null) ?? null,
    webUrl: (row['web_url'] as string | null) ?? null,
    countryCodes: (row['country_codes'] as string[] | null) ?? [],
    destinationIds: (row['destination_ids'] as string[] | null) ?? [],
    priority: (row['priority'] as number | null) ?? 0,
    status: row['status'] as StatutApp,
    submittedBy: (row['submitted_by'] as string | null) ?? null,
    reviewNote: (row['review_note'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
  };
}

/**
 * Un identifiant lisible tiré du nom.
 *
 * Le client le propose, la contrainte de la table le vérifie, et la clé
 * primaire refuse le doublon : trois filets pour un champ que personne n'a
 * envie de saisir à la main.
 */
export function identifiantDepuisNom(nom: string): string {
  const base = nom
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 60);
  // Deux caractères minimum côté base : « 99 » passe, « X » non.
  return base.length >= 2 ? base : `app-${base}`;
}

export interface AppsApi {
  /** Les fiches publiées. Le tri par destination se fait ensuite, en mémoire. */
  listPublished(): Promise<ApplicationUtile[]>;
  /** Ce que l'utilisateur courant a proposé, quel qu'en soit l'état. */
  listMine(): Promise<ApplicationEnAttente[]>;
  /** Réservé à l'administrateur : les politiques renvoient une liste vide sinon. */
  listPending(): Promise<ApplicationEnAttente[]>;
  suggest(proposition: PropositionApp): Promise<void>;
  publish(id: string): Promise<void>;
  reject(id: string, note: string): Promise<void>;
  /** Vrai si le compte connecté peut modérer. */
  amIAdmin(): Promise<boolean>;
}

function appsApi(client: NonNullable<typeof supabase>): AppsApi {
  return {
    async listPublished() {
      const { data, error } = await client
        .from('travel_apps')
        .select(COLONNES)
        .eq('status', 'published')
        .order('priority', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((row) => versApplication(row as unknown as Record<string, unknown>));
    },

    async listMine() {
      const { data: session } = await client.auth.getUser();
      const moi = session.user?.id;
      if (!moi) return [];
      const { data, error } = await client
        .from('travel_apps')
        .select(COLONNES)
        .eq('submitted_by', moi)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((row) => versApplication(row as unknown as Record<string, unknown>));
    },

    async listPending() {
      const { data, error } = await client
        .from('travel_apps')
        .select(COLONNES)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row) => versApplication(row as unknown as Record<string, unknown>));
    },

    async suggest(proposition) {
      const { data: session } = await client.auth.getUser();
      const moi = session.user?.id;
      if (!moi) throw new Error('Connectez-vous pour proposer une application.');

      const { error } = await client.from('travel_apps').insert({
        id: identifiantDepuisNom(proposition.name),
        name: proposition.name.trim(),
        category: proposition.category,
        tagline: proposition.tagline.trim(),
        why: proposition.why.trim(),
        caveat: proposition.caveat?.trim() || null,
        ios_url: proposition.iosUrl?.trim() || null,
        android_url: proposition.androidUrl?.trim() || null,
        web_url: proposition.webUrl?.trim() || null,
        country_codes: [...(proposition.countryCodes ?? [])],
        destination_ids: [...(proposition.destinationIds ?? [])],
        // Les deux champs que la politique exige : les envoyer explicitement
        // évite une erreur 42501 pour une valeur par défaut manquante.
        status: 'pending',
        submitted_by: moi,
      });
      if (error) throw error;
    },

    async publish(id) {
      const { data: session } = await client.auth.getUser();
      const { error } = await client
        .from('travel_apps')
        .update({ status: 'published', reviewed_by: session.user?.id ?? null, review_note: null })
        .eq('id', id);
      if (error) throw error;
    },

    async reject(id, note) {
      const { data: session } = await client.auth.getUser();
      const { error } = await client
        .from('travel_apps')
        .update({
          status: 'rejected',
          reviewed_by: session.user?.id ?? null,
          review_note: note.trim() || null,
        })
        .eq('id', id);
      if (error) throw error;
    },

    async amIAdmin() {
      // La liste des administrateurs n'est pas lisible côté client — c'est
      // voulu, elle contient des adresses e-mail. On demande donc au serveur
      // de répondre par oui ou non, sans jamais exposer qui.
      const { data, error } = await client.rpc('is_app_admin');
      if (error) return false;
      return data === true;
    },
  };
}

export function getApps(): AppsApi | null {
  return supabase ? appsApi(supabase) : null;
}
