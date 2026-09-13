/**
 * Ce que l'URL disait au retour de Google, avant que Supabase ne la nettoie.
 *
 * La connexion par un fournisseur externe est le seul endroit de Tripora où
 * une panne est **totalement muette** : on clique, on choisit son compte
 * Google, on revient — et l'écran de connexion réapparaît comme si rien ne
 * s'était passé. Aucune exception n'est levée, aucun message n'est affiché,
 * parce que du point de vue de l'application il n'y a simplement pas de
 * session. Impossible à diagnostiquer sans regarder le code.
 *
 * Ce module lit l'URL **une seule fois, au chargement**, avant que le client
 * Supabase ne consomme les paramètres et ne les efface de la barre d'adresse.
 * L'ordre est garanti par le graphe des imports : `supabase.ts` importe ce
 * fichier, donc celui-ci s'évalue en premier.
 *
 * La cause de très loin la plus fréquente : l'adresse d'où part la connexion
 * n'est pas dans la liste des redirections autorisées côté Supabase. Le retour
 * part alors vers l'adresse par défaut du projet, où le vérificateur PKCE
 * n'existe pas — il a été rangé dans le stockage de l'autre domaine. L'échange
 * échoue, et personne ne le dit.
 */

export interface RetourOAuth {
  /** Un code d'autorisation était présent : le retour a bien eu lieu. */
  code: boolean;
  /** Code d'erreur renvoyé par Supabase ou par Google, s'il y en a un. */
  erreur?: string;
  /** Explication lisible fournie avec l'erreur. */
  description?: string;
  /**
   * Le vérificateur PKCE était-il présent sur ce domaine au moment du retour ?
   *
   * C'est la question qui départage les deux pannes, et elle ne se pose qu'ici :
   * le client Supabase efface le vérificateur dès qu'il s'en sert. Un `code`
   * sans vérificateur veut dire qu'on a atterri **ailleurs** que là d'où l'on
   * est parti — le vérificateur est resté dans le stockage de l'autre domaine,
   * et aucun échange n'est possible. Aucune requête ne partira, aucune erreur
   * ne sera levée : c'est la panne silencieuse.
   */
  verificateur: boolean;
}

/**
 * Le vérificateur PKCE rangé par le client Supabase, s'il y en a un.
 *
 * On balaie le stockage plutôt que de recalculer la clé : elle vaut
 * `sb-<ref>-auth-token-code-verifier`, dépend de la référence du projet et du
 * `storageKey` configuré, et un balayage ne peut pas se tromper de convention.
 */
function verificateurPresent(): boolean {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const cle = localStorage.key(index);
      if (cle?.endsWith('-code-verifier') && (localStorage.getItem(cle)?.length ?? 0) > 0) {
        return true;
      }
    }
  } catch {
    // Stockage refusé (navigation privée stricte) : sans lui, PKCE ne peut de
    // toute façon pas fonctionner, et le dire vaut mieux que le supposer.
  }
  return false;
}

function lire(): RetourOAuth {
  if (typeof window === 'undefined') return { code: false, verificateur: false };
  try {
    const query = new URLSearchParams(window.location.search);
    // Le flux implicite range ses paramètres dans le fragment, pas dans la
    // requête : selon l'erreur, l'un ou l'autre porte l'information.
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/u, ''));
    const prendre = (cle: string) => query.get(cle) ?? fragment.get(cle) ?? undefined;

    const erreur = prendre('error') ?? prendre('error_code');
    const description = prendre('error_description');
    return {
      code: Boolean(prendre('code')),
      verificateur: verificateurPresent(),
      ...(erreur ? { erreur } : {}),
      ...(description ? { description } : {}),
    };
  } catch {
    return { code: false, verificateur: false };
  }
}

/** Lu au chargement du module, donc avant tout nettoyage de l'URL. */
export const RETOUR_OAUTH: RetourOAuth = lire();

/** L'adresse que Google doit connaître, déduite de celle du projet Supabase. */
function urlDeRappel(urlSupabase: string): string {
  return `${urlSupabase.replace(/\/+$/u, '')}/auth/v1/callback`;
}

/**
 * Le message à afficher quand on revient sans session.
 *
 * `null` quand il n'y a rien à dire — arriver sur l'écran de connexion sans
 * avoir rien tenté est le cas normal, et un avertissement y serait du bruit.
 */
export function diagnosticConnexion(
  retour: RetourOAuth,
  origine: string,
  urlSupabase = '',
): { titre: string; message: string; aFaire?: string } | null {
  // Supabase a bien reçu le retour de Google, mais n'a pas pu convertir le
  // code en session. Cet échange-là se fait de serveur à serveur : ni le
  // domaine d'où part la connexion, ni la liste des redirections n'y jouent le
  // moindre rôle. Le dire explicitement, parce que le réflexe est de retourner
  // fouiller cette liste — seul endroit où il est certain qu'il n'y a rien.
  if (retour.description && /exchange external code/iu.test(retour.description)) {
    return {
      titre: 'Google a répondu, le serveur n’a pas pu conclure',
      message:
        'Le code renvoyé par Google est arrivé jusqu’au serveur, qui n’a pas réussi à ' +
        'l’échanger contre une session. Cet échange est direct entre les deux serveurs : ' +
        'la liste des redirections n’y change rien. Ce sont les identifiants Google ' +
        'enregistrés côté serveur qui sont refusés — le plus souvent le secret, périmé ' +
        'ou dépareillé de son identifiant client.',
      aFaire: urlSupabase
        ? `Recollez le Client secret dans Supabase → Authentication → Providers → Google, puis vérifiez que Google autorise exactement cette URI de redirection : ${urlDeRappel(urlSupabase)}`
        : 'Recollez le Client ID et le Client secret dans Supabase → Authentication → Providers → Google.',
    };
  }

  if (retour.description) {
    return {
      titre: 'Connexion refusée',
      message: retour.description.replace(/\+/gu, ' '),
    };
  }

  if (retour.erreur) {
    return {
      titre: 'Connexion refusée',
      message: `Le fournisseur a répondu « ${retour.erreur} ». Réessayez, et si cela se reproduit, signalez-le.`,
    };
  }

  if (retour.code && !retour.verificateur) {
    // Le cas silencieux, et maintenant nommé pour ce qu'il est : on est parti
    // d'un domaine, on est revenu sur un autre. Le vérificateur PKCE est resté
    // dans le stockage du premier, et aucun échange n'est possible ici.
    return {
      titre: 'Vous n’êtes pas revenu sur le même site',
      message:
        'La connexion est partie d’une adresse et Google vous a ramené sur celle-ci, qui est ' +
        'une autre. La preuve de sécurité créée au départ est restée là-bas, et la session ne ' +
        'peut pas s’ouvrir ici. C’est ce qui se passe quand l’adresse de départ n’est pas ' +
        'autorisée côté serveur : la redirection retombe alors sur l’adresse par défaut du ' +
        'projet. Tripora relance la connexion depuis ici, où elle aboutira.',
      aFaire: `Pour que cela n’arrive plus depuis l’autre adresse, ajoutez-la dans Supabase → Authentication → URL Configuration → Redirect URLs, sous la forme : <adresse de départ>/**`,
    };
  }

  if (retour.code) {
    return {
      titre: 'Le retour de Google n’a pas abouti',
      message:
        'Vous êtes bien revenu de Google avec la preuve de sécurité attendue, mais la session ' +
        'n’a pas pu s’ouvrir. Réessayez ; si cela se reproduit, c’est côté serveur qu’il faut ' +
        'regarder.',
      aFaire: `Dans Supabase → Authentication → URL Configuration → Redirect URLs, vérifiez la présence de : ${origine}/**`,
    };
  }

  return null;
}
