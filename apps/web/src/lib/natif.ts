/**
 * Ce qui change quand Tripora tourne dans l'application mobile.
 *
 * L'application Android et iOS n'est pas une seconde application : c'est ce
 * même site, embarqué par Capacitor dans une vue web, qui parle au même
 * serveur Supabase avec la même clé publique. Un voyage créé sur le téléphone
 * apparaît sur l'ordinateur, un vote posé sur le site s'affiche dans l'app.
 *
 * Presque tout marche tel quel. Restent quatre endroits où le téléphone n'est
 * pas un navigateur, et ils sont tous ici :
 *
 * — **la connexion Google** : Google refuse d'afficher sa page de connexion
 *   dans une vue web embarquée. Elle s'ouvre donc dans le vrai navigateur, et
 *   revient dans l'application par la page `/retour-app/` du site, qui la
 *   rouvre sur `tripora://connexion` ;
 * — **les liens qu'on donne aux autres** : la page est servie depuis le
 *   téléphone lui-même (`https://localhost`), une adresse qui n'ouvre rien
 *   chez personne. Les invitations partent de l'adresse publique du site ;
 * — **le partage** : la vue web d'Android ne connaît pas `navigator.share` ;
 * — **les fichiers** : un lien `download` n'y télécharge rien.
 *
 * Les greffons natifs sont importés à la demande : sur le site, qui n'en a
 * jamais besoin, ils ne pèsent rien.
 */

/**
 * Sommes-nous dans l'application ?
 *
 * La passerelle native pose `window.Capacitor` avant le premier script de la
 * page. La lire directement évite d'importer Capacitor pour poser la
 * question : le site ne paie rien pour un code qu'il n'exécute jamais.
 */
export const estNatif: boolean =
  typeof window !== 'undefined' &&
  (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ===
    true;

/** Le schéma d'adresse de l'application : un lien `tripora://…` la rouvre. */
export const SCHEMA = 'tripora';

/** L'adresse qui rouvre l'application à la fin de la connexion Google. */
export const RETOUR_CONNEXION = `${SCHEMA}://connexion`;

/**
 * Où Supabase renvoie après Google, pour l'application.
 *
 * Pas directement `tripora://connexion` : Supabase ne renvoie que vers une
 * adresse de sa liste, et retombe sinon sur celle du site — la connexion
 * partie de l'APK se terminait alors dans le navigateur. On passe par la page
 * `/retour-app/` du site principal du projet, toujours acceptée, qui rouvre
 * l'application avec le code (voir `lib/retourApp.ts`). Sans page configurée,
 * on garde l'adresse directe : elle marche dès qu'elle est dans la liste.
 */
export const RETOUR_GOOGLE: string =
  (import.meta.env.VITE_RETOUR_APP ?? '').trim() || RETOUR_CONNEXION;

const ORIGINE_PUBLIQUE = (import.meta.env.VITE_SITE_ORIGIN ?? '').trim().replace(/\/+$/u, '');

/**
 * L'adresse à donner aux autres : celle du site, jamais celle du téléphone.
 *
 * Exportée avec ses entrées pour être testée sans simuler un téléphone.
 */
export function adressePublique(
  chemin: string,
  {
    natif = estNatif,
    originePublique = ORIGINE_PUBLIQUE,
    origineCourante = typeof window === 'undefined' ? '' : window.location.origin,
  }: { natif?: boolean; originePublique?: string; origineCourante?: string } = {},
): string {
  const origine = natif && originePublique ? originePublique : origineCourante;
  return `${origine}${chemin.startsWith('/') ? chemin : `/${chemin}`}`;
}

/* ------------------------------------------------------ Liens entrants -- */

export type LienEntrant =
  | { type: 'connexion'; code?: string; erreur?: string; description?: string }
  | { type: 'page'; chemin: string };

/**
 * Ce qu'une adresse qui rouvre l'application demande.
 *
 * `tripora://connexion?code=…` est le retour de Google. Toute autre adresse
 * `tripora://…` ou du site public désigne un écran : `tripora://rejoindre/K7M2`
 * mène à `/rejoindre/K7M2`. Le reste est ignoré plutôt que deviné — une
 * application ne doit pas se laisser piloter par n'importe quel lien.
 */
export function lireLienEntrant(
  adresse: string,
  originePublique: string = ORIGINE_PUBLIQUE,
): LienEntrant | null {
  let url: URL;
  try {
    url = new URL(adresse);
  } catch {
    return null;
  }

  if (url.protocol === `${SCHEMA}:`) {
    // Dans `tripora://rejoindre/K7M2`, « rejoindre » est lu comme l'hôte :
    // le chemin de l'écran, c'est l'hôte suivi du reste.
    const chemin = `/${url.hostname}${url.pathname}`.replace(/\/+$/u, '') || '/';
    if (url.hostname === 'connexion') {
      // Le flux PKCE renvoie ses paramètres dans la requête ; une erreur peut
      // arriver dans le fragment, selon l'étape qui a échoué.
      const fragment = new URLSearchParams(url.hash.replace(/^#/u, ''));
      const prendre = (cle: string) =>
        url.searchParams.get(cle) ?? fragment.get(cle) ?? undefined;
      const code = prendre('code');
      const erreur = prendre('error') ?? prendre('error_code');
      const description = prendre('error_description');
      return {
        type: 'connexion',
        ...(code ? { code } : {}),
        ...(erreur ? { erreur } : {}),
        ...(description ? { description } : {}),
      };
    }
    return { type: 'page', chemin: `${chemin}${url.search}` };
  }

  if (originePublique && url.origin === new URL(originePublique).origin) {
    return { type: 'page', chemin: `${url.pathname}${url.search}` };
  }
  return null;
}

/* -------------------------------------------------------------- Partage -- */

export type IssueDuPartage = 'partage' | 'annule' | 'indisponible';

/**
 * La feuille de partage du téléphone, ou celle du navigateur.
 *
 * `indisponible` laisse l'appelant se rabattre sur le presse-papiers ;
 * `annule` n'est pas une erreur, juste quelqu'un qui a changé d'avis.
 */
export async function partager({
  titre,
  texte,
  url,
}: {
  titre: string;
  texte: string;
  url: string;
}): Promise<IssueDuPartage> {
  if (estNatif) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title: titre, text: texte, url, dialogTitle: titre });
      return 'partage';
    } catch {
      return 'annule';
    }
  }
  if (typeof navigator === 'undefined' || !navigator.share) return 'indisponible';
  try {
    await navigator.share({ title: titre, text: texte, url });
    return 'partage';
  } catch {
    return 'annule';
  }
}

/**
 * Proposer un fichier fabriqué dans l'application.
 *
 * Sur le téléphone, le fichier est écrit dans le cache de l'app puis confié à
 * la feuille de partage : on l'ouvre avec son agenda, on l'envoie au groupe,
 * on l'enregistre. Renvoie `false` hors de l'application, où l'appelant
 * garde son téléchargement habituel.
 */
export async function partagerUnFichier({
  nom,
  contenu,
  titre,
}: {
  nom: string;
  contenu: string;
  titre: string;
}): Promise<boolean> {
  if (!estNatif) return false;
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const { uri } = await Filesystem.writeFile({
    path: nom,
    data: contenu,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  try {
    await Share.share({ title: titre, files: [uri], dialogTitle: titre });
  } catch {
    // Feuille refermée sans choisir : le fichier reste dans le cache, que le
    // système vide de lui-même.
  }
  return true;
}

/** Une page extérieure, dans l'onglet du navigateur système posé sur l'app. */
export async function ouvrirDansLeNavigateur(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}

export async function fermerLeNavigateur(): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  // Déjà refermé par la personne, ou jamais ouvert : rien à faire.
  await Browser.close().catch(() => undefined);
}
