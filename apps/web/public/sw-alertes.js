/*
 * Les notifications des alertes de prix, dans le service worker.
 *
 * Importé par le service worker que génère Workbox (`importScripts` dans
 * vite.config.ts). Le serveur envoie une notification vide : ni destination
 * ni prix ne passent par le service de notification du navigateur. On
 * affiche donc un message fixe, et le détail se lit dans Tripora.
 *
 * Chrome exige qu'une notification soit affichée à chaque réveil
 * (`userVisibleOnly`) : on ne filtre rien ici.
 */
/* global self, caches -- le contexte d'un service worker. */

/*
 * Le texte de la notification, dans chaque langue traduite. Une langue sans
 * entrée retombe sur le français. Pour en ajouter une : une ligne ici, sur le
 * modèle de l'anglais (voir docs/TRADUCTIONS.md).
 */
const TEXTES = {
  fr: { titre: 'Un prix que vous suivez a baissé', corps: 'Ouvrez Tripora pour voir de combien.' },
  en: { titre: 'A price you’re watching just dropped', corps: 'Open Tripora to see by how much.' },
  es: { titre: 'Un precio que sigues acaba de bajar', corps: 'Abre Tripora para ver cuánto.' },
};

/*
 * La langue de l'interface : l'application la dépose dans le cache
 * `tripora-reglages` (stores/langue.ts), seul endroit que le service worker
 * peut lire. À défaut, celle du navigateur.
 */
async function langueDeLInterface() {
  try {
    const cache = await caches.open('tripora-reglages');
    const reponse = await cache.match('/langue');
    const langue = reponse ? (await reponse.text()).trim() : (self.navigator.language || 'fr').slice(0, 2);
    return TEXTES[langue] ? langue : 'fr';
  } catch {
    return 'fr';
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    langueDeLInterface().then((langue) =>
      self.registration.showNotification(TEXTES[langue].titre, {
        body: TEXTES[langue].corps,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        lang: langue,
        // Plusieurs baisses le même matin : une seule notification, remplacée.
        tag: 'alertes-de-prix',
        data: { url: '/alertes' },
      }),
    ),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const adresse = new URL(event.notification.data?.url ?? '/alertes', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      // Tripora déjà ouvert : on y va, plutôt que d'ouvrir un second onglet.
      for (const fenetre of fenetres) {
        if (new URL(fenetre.url).origin === self.location.origin && 'focus' in fenetre) {
          // `navigate` échoue sur une fenêtre que ce service worker ne
          // contrôle pas encore : elle reste alors au premier plan, telle quelle.
          return fenetre.focus().then((ouverte) => ouverte.navigate(adresse).catch(() => ouverte));
        }
      }
      return self.clients.openWindow(adresse);
    }),
  );
});
