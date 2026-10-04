import { estNatif } from '@/lib/natif';
import { supabase } from '@/lib/supabase';

/**
 * Les erreurs de l'application, remontées dans la table `erreurs_client`.
 *
 * Un écran qui plante chez quelqu'un ne laissait aucune trace : on
 * l'apprenait par hasard, ou jamais. Ici, une erreur non rattrapée part au
 * serveur — nettoyée avant : pas d'adresse e-mail, pas d'identifiant de
 * voyage, pas de paramètre d'adresse, rien qui désigne une personne (voir
 * Confidentialité). Pas de compte joint, et la table ne se relit pas depuis
 * l'application.
 *
 * Retenue : cinq envois au plus par ouverture, jamais deux fois le même
 * message, et rien de ce qui n'est pas une panne — une coupure de réseau est
 * un état normal hors ligne, pas un bogue.
 */

const MAX_PAR_OUVERTURE = 5;
const envoyes = new Set<string>();

/** Ce qui n'est pas un défaut de Tripora : le réseau, le navigateur, une extension. */
const BRUIT = [
  /^ResizeObserver loop/iu,
  /^Script error\.?$/iu,
  /Failed to fetch$|Load failed$|NetworkError when attempting to fetch/iu,
  /AbortError|The user aborted a request|signal is aborted/iu,
  /^Non-Error promise rejection captured/iu,
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;

/**
 * Retire d'un texte ce qui pourrait désigner quelqu'un ou quelque chose de
 * privé : adresses e-mail, identifiants, paramètres et fragments d'adresse,
 * longues suites de chiffres (téléphone, IBAN, code d'invitation).
 */
export function nettoyer(texte: string): string {
  return texte
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/gu, '<e-mail>')
    .replace(UUID, ':id')
    .replace(/([?#])[^\s)'"]*/gu, '$1…')
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9 ]{10,30}\b/gu, '<iban>')
    .replace(/\d{6,}/gu, '<nombre>')
    .replace(/\b[A-Z0-9]{8}\b/gu, (mot) => (/\d/u.test(mot) && /[A-Z]/u.test(mot) ? '<code>' : mot));
}

/** La page, sans ses identifiants : « /voyages/:id/budget ». */
export function pageSansIdentifiant(chemin: string): string {
  return chemin.replace(UUID, ':id').replace(/\/v\d+(?=\/|$)/gu, '/:id').slice(0, 200);
}

function plateforme(): 'web' | 'android' | 'ios' {
  if (!estNatif) return 'web';
  return /android/iu.test(navigator.userAgent) ? 'android' : 'ios';
}

/** Le navigateur, en deux mots : « Chrome 141 », « Safari 18 ». Pas l'empreinte complète. */
function navigateur(): string {
  const ua = navigator.userAgent;
  // Dans l'ordre : Edge et Opera se disent aussi « Chrome », Chrome se dit aussi « Safari ».
  for (const nom of ['Edg', 'OPR', 'SamsungBrowser', 'Firefox', 'CriOS', 'Chrome']) {
    const version = new RegExp(`${nom}/(\\d+)`, 'u').exec(ua)?.[1];
    if (version) return `${nom} ${version}`;
  }
  const safari = /Version\/(\d+).*Safari\//u.exec(ua)?.[1];
  return safari ? `Safari ${safari}` : 'autre';
}

/** Remonte une erreur, si elle en vaut la peine et que la limite n'est pas atteinte. */
export function remonterUneErreur(erreur: unknown): void {
  if (!supabase || !import.meta.env.PROD) return;
  const brut = erreur instanceof Error ? erreur.message || erreur.name : String(erreur ?? '');
  const message = nettoyer(brut).trim().slice(0, 500);
  if (!message || BRUIT.some((motif) => motif.test(message))) return;
  if (envoyes.has(message) || envoyes.size >= MAX_PAR_OUVERTURE) return;
  envoyes.add(message);

  const pile = erreur instanceof Error && erreur.stack ? nettoyer(erreur.stack.replaceAll(location.origin, '')).slice(0, 4000) : null;
  // Sans attendre ni relancer : une erreur dans le signalement d'une erreur ne doit rien casser de plus.
  void supabase
    .from('erreurs_client')
    .insert({
      message,
      pile,
      page: pageSansIdentifiant(location.pathname),
      version: __VERSION__,
      plateforme: plateforme(),
      langue: document.documentElement.lang.slice(0, 10) || null,
      navigateur: navigateur(),
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/** Écoute les erreurs que personne n'a rattrapées, sur toute la page. */
export function surveillerLesErreurs(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (evenement) => remonterUneErreur(evenement.error ?? evenement.message));
  window.addEventListener('unhandledrejection', (evenement) => remonterUneErreur(evenement.reason));
}
