/*
 * Les notifications de Tripora, dans le service worker.
 *
 * Importé par le service worker que génère Workbox (`importScripts` dans
 * vite.config.ts). Deux sortes de notifications arrivent ici :
 *
 * - sans contenu : une alerte de prix. Le serveur ne fait que réveiller le
 *   navigateur — ni destination ni prix ne passent par le service de
 *   notification — et on affiche un message fixe ; le détail se lit dans
 *   Tripora ;
 * - avec un contenu chiffré pour cet appareil (le navigateur l'a déjà
 *   déchiffré quand il nous parvient) : ce qui se passe dans un voyage — un
 *   message, une dépense, une arrivée, une décision. On le met en mots ici,
 *   dans la langue de l'interface, et le toucher ouvre le bon écran.
 *
 * Chrome exige qu'une notification soit affichée à chaque réveil
 * (`userVisibleOnly`) : on ne filtre que le message qu'on est déjà en train
 * de lire, page au premier plan.
 */
/* global self, caches -- le contexte d'un service worker. */

const NBSP = ' ';
const guillemets = (texte) => `«${NBSP}${texte}${NBSP}»`;

/*
 * Les textes, dans chaque langue traduite. Une langue sans entrée retombe sur
 * le français. Pour en ajouter une : un bloc ici, sur le modèle de l'anglais
 * (voir docs/TRADUCTIONS.md).
 */
const TEXTES = {
  fr: {
    prix: { titre: 'Un prix que vous suivez a baissé', corps: 'Ouvrez Tripora pour voir de combien.' },
    inconnu: { titre: 'Tripora', corps: 'Du nouveau dans votre voyage.' },
    message: (d) =>
      d.nombre > 1
        ? { titre: `${d.nombre} nouveaux messages · ${d.voyage}`, corps: `${d.qui}${NBSP}: ${d.extrait}` }
        : { titre: `${d.qui} · ${d.voyage}`, corps: d.extrait },
    depense: (d, montant) => ({
      titre: `Nouvelle dépense · ${d.voyage}`,
      corps: `${d.qui} a ajouté ${guillemets(d.libelle)}${montant ? `${NBSP}: ${montant}` : ''}.`,
    }),
    membre: (d) => ({ titre: d.voyage, corps: `${d.qui} a rejoint le voyage.` }),
    sondage: (d) => ({
      titre: `Nouveau sondage · ${d.voyage}`,
      corps: `${d.qui} demande${NBSP}: ${guillemets(d.question)}${d.secret ? ' Vote secret.' : ''}`,
    }),
    destination: (d) => ({ titre: `C’est décidé${NBSP}!`, corps: `${d.voyage}${NBSP}: direction ${d.destination}.` }),
    tache: (d) => ({ titre: d.voyage, corps: `${d.qui} vous confie ${guillemets(d.titre)}.` }),
    tous_ont_vote: (d) => ({
      titre: d.voyage,
      corps: `Tout le monde a voté sur la destination${NBSP}: à vous de trancher.`,
    }),
    envies: (d) => ({ titre: d.voyage, corps: 'Le groupe attend vos envies pour proposer des destinations.' }),
  },
  en: {
    prix: { titre: 'A price you’re watching just dropped', corps: 'Open Tripora to see by how much.' },
    inconnu: { titre: 'Tripora', corps: 'Something new in your trip.' },
    message: (d) =>
      d.nombre > 1
        ? { titre: `${d.nombre} new messages · ${d.voyage}`, corps: `${d.qui}: ${d.extrait}` }
        : { titre: `${d.qui} · ${d.voyage}`, corps: d.extrait },
    depense: (d, montant) => ({
      titre: `New expense · ${d.voyage}`,
      corps: `${d.qui} added “${d.libelle}”${montant ? `: ${montant}` : ''}.`,
    }),
    membre: (d) => ({ titre: d.voyage, corps: `${d.qui} joined the trip.` }),
    sondage: (d) => ({
      titre: `New poll · ${d.voyage}`,
      corps: `${d.qui} asks: “${d.question}”${d.secret ? ' Secret vote.' : ''}`,
    }),
    destination: (d) => ({ titre: 'It’s decided!', corps: `${d.voyage}: heading to ${d.destination}.` }),
    tache: (d) => ({ titre: d.voyage, corps: `${d.qui} asked you to handle “${d.titre}”.` }),
    tous_ont_vote: (d) => ({ titre: d.voyage, corps: 'Everyone has voted on the destination: your call.' }),
    envies: (d) => ({ titre: d.voyage, corps: 'The group is waiting for your wishes to suggest destinations.' }),
  },
};

/* L'écran que le toucher ouvre, genre par genre. */
const ECRANS = {
  message: (id) => `/voyages/${id}/discussion`,
  depense: (id) => `/voyages/${id}/budget`,
  membre: (id) => `/voyages/${id}/participants`,
  sondage: (id) => `/voyages/${id}/sondages`,
  destination: (id) => `/voyages/${id}`,
  tache: (id) => `/voyages/${id}/qui-fait-quoi`,
  tous_ont_vote: (id) => `/voyages/${id}#trancher`,
  envies: (id) => `/voyages/${id}/mes-envies`,
};

/* Ce qui se remplace au lieu de s'empiler : la conversation, le rappel. */
const REMPLACABLES = new Set(['message', 'envies', 'tous_ont_vote', 'destination']);

function montantLisible(centimes, devise, langue) {
  if (typeof centimes !== 'number' || typeof devise !== 'string') return '';
  try {
    return new Intl.NumberFormat(langue, { style: 'currency', currency: devise }).format(centimes / 100);
  } catch {
    return '';
  }
}

/**
 * Le titre, le texte, l'étiquette et l'adresse d'une notification, à partir
 * de son contenu (ou de rien : une alerte de prix). Pure, et testée
 * (`src/lib/swAlertes.test.ts`).
 */
function composerLaNotification(contenu, langue) {
  const textes = TEXTES[langue] ?? TEXTES.fr;
  if (!contenu || typeof contenu !== 'object' || typeof contenu.genre !== 'string') {
    return { ...textes.prix, tag: 'alertes-de-prix', url: '/alertes' };
  }
  const { genre, voyageId } = contenu;
  const rediger = textes[genre];
  const adresse = ECRANS[genre] && typeof voyageId === 'string' ? ECRANS[genre](voyageId) : '/voyages';
  if (typeof rediger !== 'function') return { ...textes.inconnu, tag: undefined, url: adresse };
  const { titre, corps } = rediger(contenu, montantLisible(contenu.montant, contenu.devise, langue));
  return {
    titre,
    corps,
    tag: REMPLACABLES.has(genre) ? `${genre}-${voyageId}` : undefined,
    url: adresse,
  };
}

self.composerLaNotification = composerLaNotification;

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

function lireLeContenu(event) {
  try {
    return event.data ? event.data.json() : null;
  } catch {
    return null;
  }
}

/* La discussion de ce voyage est déjà sous les yeux : inutile d'en rajouter. */
async function dejaSousLesYeux(adresse) {
  const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return fenetres.some((fenetre) => fenetre.focused && new URL(fenetre.url).pathname === adresse);
}

self.addEventListener('push', (event) => {
  const contenu = lireLeContenu(event);
  event.waitUntil(
    langueDeLInterface().then(async (langue) => {
      const notification = composerLaNotification(contenu, langue);
      if (contenu?.genre === 'message' && (await dejaSousLesYeux(notification.url))) return;
      await self.registration.showNotification(notification.titre, {
        body: notification.corps,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        lang: langue,
        ...(notification.tag ? { tag: notification.tag, renotify: true } : {}),
        data: { url: notification.url },
      });
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
