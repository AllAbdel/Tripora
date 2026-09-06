/**
 * Configuration lue à la construction. Aucune clé secrète ici : seule la clé
 * « anon » de Supabase est publique par conception, et elle ne sert à rien
 * sans les politiques RLS qui filtrent chaque ligne côté base.
 *
 * L'application doit rester utilisable même sans configuration : c'est le
 * « mode local », qui permet de découvrir l'interface avant d'avoir créé le
 * moindre compte.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  appName: 'Tripora',
} as const;

export const isSupabaseConfigured = Boolean(url && anonKey);
