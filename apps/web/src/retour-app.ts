import { retourVersLApp, systemeDe } from '@/lib/retourApp';

/**
 * Le script de `retour-app/index.html` : rendre la main à l'application.
 *
 * On tente d'abord d'y retourner seul. Chrome peut le refuser — il n'ouvre une
 * autre application qu'à la suite d'un geste — et le bouton est là pour ça :
 * toucher « Ouvrir Tripora » est ce geste.
 */

const TEXTES = {
  fr: {
    titre: 'Connexion réussie',
    message: 'Tripora va se rouvrir. Si rien ne se passe, touchez le bouton.',
    refus: 'Connexion refusée',
    refusSuite: 'Revenez dans Tripora pour réessayer.',
    ouvrir: 'Ouvrir Tripora',
    aide: 'Vous pouvez ensuite fermer cet onglet.',
    rien: 'Rien à faire ici',
    rienMessage: 'Cette page sert au retour de connexion de l’application Tripora.',
    site: 'Aller sur Tripora',
  },
  en: {
    titre: 'Signed in',
    message: 'Tripora is reopening. If nothing happens, tap the button.',
    refus: 'Sign-in refused',
    refusSuite: 'Go back to Tripora to try again.',
    ouvrir: 'Open Tripora',
    aide: 'You can close this tab afterwards.',
    rien: 'Nothing to do here',
    rienMessage: 'This page brings the Tripora app back after signing in.',
    site: 'Go to Tripora',
  },
} as const;

const textes = /^fr\b/iu.test(navigator.language || 'fr') ? TEXTES.fr : TEXTES.en;
document.documentElement.lang = textes === TEXTES.fr ? 'fr' : 'en';

const retour = retourVersLApp(window.location.search, window.location.hash);
const systeme = systemeDe(navigator.userAgent);

const titre = document.getElementById('titre');
const message = document.getElementById('message');
const bouton = document.getElementById('ouvrir') as HTMLAnchorElement | null;
const aide = document.getElementById('aide');

if (!retour.utile) {
  if (titre) titre.textContent = textes.rien;
  if (message) message.textContent = textes.rienMessage;
  if (bouton) {
    bouton.textContent = textes.site;
    bouton.href = '/';
  }
} else {
  if (titre) titre.textContent = retour.erreur ? textes.refus : textes.titre;
  if (message) {
    message.textContent = retour.erreur ? `${retour.erreur}. ${textes.refusSuite}` : textes.message;
  }
  if (bouton) {
    bouton.textContent = textes.ouvrir;
    bouton.href = retour.schema;
  }
  if (aide) aide.textContent = textes.aide;

  // Le code n'a rien à faire dans l'historique du navigateur : il ne sert
  // qu'une fois, et seulement à l'application qui détient la preuve PKCE.
  window.history.replaceState(null, '', window.location.pathname);

  // Sur un ordinateur, il n'y a pas d'application à rouvrir.
  if (systeme !== 'autre') {
    window.location.replace(systeme === 'android' ? retour.intention : retour.schema);
  }
}
