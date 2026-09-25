import { requireSupabase } from './supabase';
import { fermerLeNavigateur, ouvrirDansLeNavigateur, RETOUR_GOOGLE, type LienEntrant } from './natif';

/**
 * La connexion Google, depuis l'application mobile.
 *
 * Sur le site, on quitte la page pour Google et on y revient : le navigateur
 * garde tout. Dans l'application, Google refuse sa page de connexion dans une
 * vue web embarquée (« disallowed_useragent »). Le parcours passe donc par le
 * navigateur du téléphone, posé par-dessus l'app :
 *
 *   1. Supabase prépare l'adresse de Google, sans y aller lui-même, et range
 *      la preuve PKCE dans le stockage de l'app ;
 *   2. le navigateur système l'ouvre ; on choisit son compte ;
 *   3. Supabase renvoie vers la page `/retour-app/` du site, qui rouvre
 *      `tripora://connexion?code=…` : le téléphone le confie à Tripora ;
 *   4. l'app échange ce code contre une session, avec la preuve restée chez
 *      elle. Intercepté par une autre application, le code seul ne vaut rien.
 */
export async function commencerLaConnexionGoogle(): Promise<void> {
  const { data, error } = await requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: RETOUR_GOOGLE, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Le serveur n’a pas fourni l’adresse de connexion Google.');
  await ouvrirDansLeNavigateur(data.url);
}

/**
 * Rattacher Google au compte invité, depuis l'application mobile.
 *
 * Le même aller-retour que la connexion, par `tripora://connexion` : seule la
 * demande change. Au retour, l'échange du code rend la session du même
 * compte, désormais lié à Google.
 */
export async function commencerLeRattachementGoogle(): Promise<void> {
  const { data, error } = await requireSupabase().auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: RETOUR_GOOGLE, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Le serveur n’a pas fourni l’adresse de Google.');
  await ouvrirDansLeNavigateur(data.url);
}

/**
 * Le retour de Google. Renvoie le message à afficher, ou `null` si la session
 * est ouverte.
 */
export async function conclureLaConnexion(
  retour: Extract<LienEntrant, { type: 'connexion' }>,
): Promise<string | null> {
  await fermerLeNavigateur();

  if (retour.description) return retour.description.replace(/\+/gu, ' ');
  if (retour.erreur) return `Google a répondu « ${retour.erreur} ». Réessayez.`;
  if (!retour.code) return 'Le retour de Google ne contenait aucun code de connexion.';

  const { error } = await requireSupabase().auth.exchangeCodeForSession(retour.code);
  if (!error) return null;
  // Le cas qui arrive vraiment : l'app a été fermée pendant qu'on était chez
  // Google, et la preuve PKCE est partie avec elle.
  return /verifier/iu.test(error.message)
    ? 'La connexion a été interrompue. Relancez-la depuis cet écran.'
    : error.message;
}
