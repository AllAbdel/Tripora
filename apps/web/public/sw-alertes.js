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

self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Un prix que vous suivez a baissé', {
      body: 'Ouvrez Tripora pour voir de combien.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      lang: 'fr',
      // Plusieurs baisses le même matin : une seule notification, remplacée.
      tag: 'alertes-de-prix',
      data: { url: '/alertes' },
    }),
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
