import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Tripora sur Android et iOS.
 *
 * L'application embarque le site construit en mode mobile
 * (`apps/web/dist-mobile`) et parle au même projet Supabase : aucune donnée
 * n'est propre au téléphone, tout ce qu'on y fait se retrouve sur le site.
 */
const config: CapacitorConfig = {
  // L'identifiant du paquet ne change plus jamais une fois l'application
  // installée : un autre identifiant, c'est une autre application.
  appId: 'fr.tripora.app',
  appName: 'Tripora',
  webDir: '../web/dist-mobile',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      // Retiré par l'application quand la première page est dessinée, pas au
      // bout d'un délai : ni écran blanc, ni attente inutile.
      launchAutoHide: false,
      backgroundColor: '#0b1220',
      showSpinner: false,
    },
    SystemBars: {
      // La page déclare `viewport-fit=cover` et gère elle-même les encoches
      // avec `env(safe-area-inset-*)` : le dire d'avance évite un saut de mise
      // en page au démarrage.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      // La silhouette du repère de carte (res/drawable/ic_stat_tripora.xml),
      // teintée du bleu de Tripora. Sans elle, Android affiche un « i ».
      smallIcon: 'ic_stat_tripora',
      iconColor: '#0A84FF',
    },
  },
};

export default config;
