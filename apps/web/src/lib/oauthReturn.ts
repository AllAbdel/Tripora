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
}

function lire(): RetourOAuth {
  if (typeof window === 'undefined') return { code: false };
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
      ...(erreur ? { erreur } : {}),
      ...(description ? { description } : {}),
    };
  } catch {
    return { code: false };
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

  if (retour.code) {
    // Le cas silencieux, et de loin le plus courant : le retour a bien eu
    // lieu, mais la session n'a pas pu être ouverte sur ce domaine-ci.
    return {
      titre: 'Le retour de Google n’a pas abouti',
      message:
        'Vous êtes bien revenu de Google, mais la session n’a pas pu être ouverte sur cette adresse. ' +
        'C’est presque toujours que cette adresse n’est pas autorisée côté serveur.',
      aFaire: `Dans Supabase → Authentication → URL Configuration → Redirect URLs, ajoutez : ${origine}/**`,
    };
  }

  return null;
}
