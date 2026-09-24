import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { estNatif, lireLienEntrant } from '@/lib/natif';
import { conclureLaConnexion } from '@/lib/connexionNative';

/**
 * Ce que le téléphone dit à l'application, traduit pour le routeur.
 *
 * Ne rend rien, et ne fait rien du tout sur le site. Dans l'application :
 *
 * — **les liens qui rouvrent Tripora** : le retour de Google après la
 *   connexion, ou une invitation `tripora://rejoindre/…`, y compris quand
 *   c'est ce lien qui a lancé l'application ;
 * — **le bouton retour d'Android** : il revient à l'écran précédent, comme
 *   dans le navigateur, et ne ferme l'application que depuis le premier ;
 * — **les barres du système** : leurs icônes suivent le thème choisi dans
 *   Tripora, pas seulement celui du téléphone — sinon une heure blanche
 *   disparaît sur le fond clair du thème clair choisi la nuit ;
 * — **l'écran de lancement**, retiré quand la première page est dessinée
 *   plutôt qu'au bout d'un délai arbitraire.
 */
export function PontNatif() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!estNatif) return;
    let actif = true;
    const retraits: (() => void)[] = [];

    async function traiter(adresse: string) {
      const lien = lireLienEntrant(adresse);
      if (!lien || !actif) return;
      if (lien.type === 'page') {
        navigate(lien.chemin);
        return;
      }
      const erreur = await conclureLaConnexion(lien);
      if (!actif) return;
      // Session ouverte : l'écran de connexion laisse place aux voyages de
      // lui-même. Sinon on y revient, avec la raison.
      navigate(erreur ? '/' : '/voyages', {
        replace: true,
        ...(erreur ? { state: { erreurDeConnexion: erreur } } : {}),
      });
    }

    void (async () => {
      const { App } = await import('@capacitor/app');
      const { SplashScreen } = await import('@capacitor/splash-screen');
      if (!actif) return;

      const ouverture = await App.addListener('appUrlOpen', ({ url }) => void traiter(url));
      const retour = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else void App.exitApp();
      });
      retraits.push(() => void ouverture.remove(), () => void retour.remove());
      // Démonté pendant qu'on s'abonnait : on se désabonne aussitôt.
      if (!actif) {
        void ouverture.remove();
        void retour.remove();
        return;
      }

      const lancement = await App.getLaunchUrl();
      if (lancement?.url) await traiter(lancement.url);

      await SplashScreen.hide();
    })();

    // Le thème est posé en classe sur <html> : on suit la classe, quelle que
    // soit la raison de son changement (réglage, système, heure).
    const suivreLeTheme = () => {
      const sombre = document.documentElement.classList.contains('dark');
      void import('@capacitor/core').then(({ SystemBars, SystemBarsStyle }) =>
        SystemBars.setStyle({ style: sombre ? SystemBarsStyle.Dark : SystemBarsStyle.Light }),
      );
    };
    suivreLeTheme();
    const observateur = new MutationObserver(suivreLeTheme);
    observateur.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    retraits.push(() => observateur.disconnect());

    return () => {
      actif = false;
      for (const retirer of retraits) retirer();
    };
  }, [navigate]);

  return null;
}
