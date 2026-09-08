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

/**
 * L'identifiant de partenaire Travelpayouts, s'il y en a un.
 *
 * Il est **public par nature** : il figure dans chaque lien de réservation
 * qu'on produit, visible de quiconque regarde l'URL. Le mettre parmi les
 * secrets du serveur n'aurait rien protégé et l'aurait rendu inaccessible là
 * où on en a besoin — les liens se construisent dans le navigateur.
 *
 * À ne pas confondre avec `TRAVELPAYOUTS_TOKEN`, qui est un vrai secret et
 * reste côté Edge Functions : lui sert à interroger l'API de prix.
 */
const marker = import.meta.env.VITE_TRAVELPAYOUTS_MARKER?.trim() ?? '';

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  travelpayoutsMarker: marker,
  appName: 'Tripora',
} as const;

export const isSupabaseConfigured = Boolean(url && anonKey);
