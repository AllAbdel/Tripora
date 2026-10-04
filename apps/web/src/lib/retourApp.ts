/**
 * La page de retour de connexion de l'application mobile.
 *
 * Supabase ne renvoie, après Google, que vers une adresse de sa liste ; à
 * défaut, il retombe sur l'adresse du site. C'est ce qui arrivait avec
 * `tripora://connexion` absente de la liste : la connexion partie de l'APK se
 * terminait dans le navigateur, sur le site, et l'application restait à
 * l'écran de connexion.
 *
 * Le retour passe donc par une page du site lui-même, que Supabase accepte
 * toujours, et c'est elle qui rend la main à l'application. Elle ne charge pas
 * Tripora : le site, en voyant un code de connexion sans la preuve PKCE restée
 * dans l'app, relancerait une connexion Google dans le navigateur.
 */

/** Les seuls paramètres qu'on transmet à l'application, et aucun autre. */
const TRANSMIS = ['code', 'error', 'error_code', 'error_description'] as const;

/** Le paquet Android, celui de `apps/mobile/capacitor.config.ts`. */
export const PAQUET_ANDROID = 'fr.tripora.app';

export interface RetourVersLApp {
  /** Il y a quelque chose à rendre à l'application : un code ou une erreur. */
  utile: boolean;
  erreur?: string;
  /** `tripora://connexion?…`, que tous les navigateurs confient au système. */
  schema: string;
  /**
   * La même adresse en intention Android, que Chrome sait adresser à Tripora
   * sans passer par le choix d'une application.
   */
  intention: string;
}

/**
 * Ce qu'il faut rendre à l'application, lu dans l'adresse de la page.
 *
 * Supabase range le code dans la requête, et une erreur tantôt dans la
 * requête, tantôt dans le fragment : on lit les deux, et on ne garde que les
 * paramètres connus. Un lien qui reprendrait tout tel quel laisserait
 * n'importe quelle page piloter l'application.
 */
export function retourVersLApp(recherche: string, fragment: string): RetourVersLApp {
  const requete = new URLSearchParams(recherche.replace(/^\?/u, ''));
  const diese = new URLSearchParams(fragment.replace(/^#/u, ''));
  const transmis = new URLSearchParams();
  for (const cle of TRANSMIS) {
    const valeur = requete.get(cle) ?? diese.get(cle);
    if (valeur) transmis.set(cle, valeur);
  }

  const suite = transmis.toString();
  const chemin = `connexion${suite ? `?${suite}` : ''}`;
  const erreur = transmis.get('error_description') ?? transmis.get('error') ?? undefined;
  return {
    utile: transmis.has('code') || Boolean(erreur),
    ...(erreur ? { erreur: erreur.replace(/\+/gu, ' ') } : {}),
    schema: `tripora://${chemin}`,
    intention: `intent://${chemin}#Intent;scheme=tripora;package=${PAQUET_ANDROID};end`,
  };
}

/** Sur quel système la page est-elle ouverte ? */
export function systemeDe(agent: string): 'android' | 'ios' | 'autre' {
  if (/android/iu.test(agent)) return 'android';
  if (/iphone|ipad|ipod/iu.test(agent)) return 'ios';
  return 'autre';
}
