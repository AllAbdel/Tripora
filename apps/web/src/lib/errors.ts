/**
 * Traduction des pannes en phrases utiles.
 *
 * Une application de voyage tourne dans le métro, à l'étranger, sur un forfait
 * saturé : l'échec réseau est un état normal, pas un cas exceptionnel. Chaque
 * message dit ce qui s'est passé et ce que l'utilisateur peut faire.
 */
export type FailureKind =
  | 'offline'
  | 'unreachable'
  | 'timeout'
  | 'quota'
  | 'unauthenticated'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'server'
  | 'unknown';

export interface Failure {
  kind: FailureKind;
  message: string;
  /** Piste d'action concrète, affichée sous le message. */
  hint?: string;
  retryable: boolean;
}

const MESSAGES: Record<FailureKind, Omit<Failure, 'kind'>> = {
  offline: {
    message: 'Pas de connexion pour le moment.',
    hint: 'Le voyage déjà chargé reste consultable hors ligne.',
    retryable: true,
  },
  unreachable: {
    message: 'Le serveur ne répond pas.',
    hint: 'Votre connexion a l’air active : c’est sans doute passager. Réessayez dans un instant.',
    retryable: true,
  },
  timeout: {
    message: 'Le serveur met trop de temps à répondre.',
    hint: 'Réessayez dans un instant.',
    retryable: true,
  },
  quota: {
    message: "La limite gratuite du jour est atteinte pour cette fonction.",
    hint: 'Tout le reste de Tripora continue de fonctionner. Réessayez demain.',
    retryable: false,
  },
  unauthenticated: {
    message: 'Vous devez être connecté pour faire cela.',
    retryable: false,
  },
  forbidden: {
    message: "Vous n'avez pas accès à ce voyage.",
    hint: 'Demandez un lien d’invitation à la personne qui l’a créé.',
    retryable: false,
  },
  notFound: {
    message: 'Ce voyage n’existe plus.',
    retryable: false,
  },
  conflict: {
    message: 'Quelqu’un a modifié ce voyage en même temps que vous.',
    hint: 'La version la plus récente vient d’être rechargée.',
    retryable: true,
  },
  server: {
    message: 'Le serveur a rencontré un problème.',
    hint: 'Ce n’est pas de votre fait. Réessayez dans quelques minutes.',
    retryable: true,
  },
  unknown: {
    message: 'Une erreur inattendue est survenue.',
    retryable: true,
  },
};

/** Motifs propres aux pannes de transport, assez précis pour ne pas happer
 *  un message d'erreur métier qui parlerait de réseau. */
const NETWORK_SIGNATURE =
  /failed to fetch|fetch failed|load failed|networkerror|network request failed|err_(internet|network|connection)/i;

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return typeof error === 'string' ? error : '';
}

export function toFailure(error: unknown): Failure {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { kind: 'offline', ...MESSAGES.offline };
  }

  // Un échec réseau se présente au mieux comme un TypeError au message peu
  // engageant (« Failed to fetch », « Load failed » selon les navigateurs),
  // au pire comme un objet nu portant le même texte : supabase-js attrape
  // l'exception et la renvoie sous la forme { message, details, hint, code }.
  // On reconnaît donc la signature sur le message, quelle que soit la forme.
  if (NETWORK_SIGNATURE.test(messageOf(error))) {
    return { kind: 'unreachable', ...MESSAGES.unreachable };
  }

  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status: unknown }).status)
      : undefined;

  const kind: FailureKind =
    status === 401 ? 'unauthenticated'
    : status === 403 ? 'forbidden'
    : status === 404 ? 'notFound'
    : status === 409 ? 'conflict'
    : status === 429 ? 'quota'
    : status !== undefined && status >= 500 ? 'server'
    : 'unknown';

  return { kind, ...MESSAGES[kind] };
}
