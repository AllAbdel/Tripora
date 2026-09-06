import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';

/**
 * Client unique. Vaut `null` tant que le projet Supabase n'est pas renseigné,
 * ce qui laisse l'application démarrer en mode local plutôt que d'exploser au
 * chargement avec une erreur incompréhensible.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: { headers: { 'x-application-name': 'tripora-web' } },
    })
  : null;

/** À utiliser dans le code qui exige un backend : l'erreur est explicite. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Tripora n'est pas encore relié à un serveur. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.",
    );
  }
  return supabase;
}
