import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

/**
 * L'adresse publique du site, pour les balises de partage.
 *
 * Open Graph veut une URL absolue : une image en chemin relatif n'est pas
 * suivie par tous les robots, et le lien collé dans la conversation du groupe
 * s'affiche alors sans aperçu. On la prend dans l'environnement — c'est la
 * même que celle de l'authentification quand elle est renseignée — et à
 * défaut on retombe sur le chemin relatif, qui marche chez la plupart.
 */
function origineDuSite(): Plugin {
  return {
    name: 'tripora-origine-du-site',
    transformIndexHtml(html) {
      const brute = process.env['VITE_SITE_ORIGIN'] ?? process.env['VITE_AUTH_ORIGIN'] ?? '';
      const origine = brute.trim().replace(/\/+$/u, '');
      return html.replaceAll('%ORIGINE_DU_SITE%', origine);
    },
  };
}

export default defineConfig(({ mode }) => {
  /**
   * L'application mobile embarque ce même site, construit avec `--mode mobile`.
   *
   * Deux différences seulement. Pas de Service Worker : les fichiers sont déjà
   * sur le téléphone, dans l'application, et un cache par-dessus ne ferait que
   * servir l'ancienne version après une mise à jour de l'APK. Et un dossier de
   * sortie à part, pour qu'un build mobile n'écrase jamais celui du site.
   */
  const mobile = mode === 'mobile';
  return {
    plugins: [
      react(),
      tailwindcss(),
      origineDuSite(),
      VitePWA({
        disable: mobile,
        registerType: 'autoUpdate',
        // Ce que la page demande elle-même à chaque ouverture, et qui doit donc
        // rester disponible hors ligne.
        includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
        // Les icônes du manifeste, elles, sont récupérées par le navigateur au
        // moment d'installer, puis gardées par le système. Le réglage par défaut
        // les précharge malgré tout — un demi-mégaoctet téléchargé deux fois,
        // qu'aucun écran ne demande jamais.
        includeManifestIcons: false,
        manifest: {
          name: 'Tripora — voyages entre amis',
          short_name: 'Tripora',
          description:
            "Organisez un voyage à plusieurs : envies de chacun, budget réel, vote du groupe, itinéraire et carte.",
          lang: 'fr',
          dir: 'ltr',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0b1220',
          theme_color: '#0a84ff',
          categories: ['travel', 'lifestyle', 'productivity'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          /**
           * Ce que la première visite ne doit pas payer.
           *
           * Le préchargement était devenu un forfait de 4,5 Mo téléchargés
           * avant le premier écran, sur un produit qu'on ouvre en déplacement,
           * souvent en itinérance. Presque tout était du poids mort :
           *
           * — les 147 drapeaux, un mégaoctet à eux seuls et presque tout dû à
           *   une vingtaine d'armoiries détaillées, alors que chacun n'en voit
           *   qu'une poignée ;
           * — la carte et son ouvrier de rendu, 1,5 Mo, pour un onglet que
           *   beaucoup n'ouvrent jamais ;
           * — l'image de partage, que seuls les robots des messageries vont
           *   chercher, jamais le navigateur de quelqu'un ;
           * — l'image de couverture d'un écran de soutien, vue une fois ;
           * — les trois grandes icônes du manifeste, un demi-mégaoctet que le
           *   navigateur va chercher lui-même au moment d'installer et que le
           *   système garde ensuite : les précharger, c'est les télécharger
           *   deux fois. Le favicon et l'icône Apple, eux, restent : la page
           *   les demande à chaque ouverture.
           *
           * Rien de tout cela ne disparaît hors ligne pour autant : la règle
           * « ressources de l'application » plus bas les garde dès la première
           * fois qu'on s'en sert. On paie ce qu'on utilise, quand on l'utilise.
           */
          globIgnores: [
            '**/flags/*.svg',
            '**/assets/TripMapScreen-*',
            '**/assets/maplibre-gl-worker-*',
            '**/icons/og-image.png',
            '**/icons/icon-192.png',
            '**/icons/icon-512.png',
            '**/icons/icon-maskable-512.png',
            '**/*.jpg',
          ],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Tuiles de carte : réutilisées agressivement, elles ne changent
              // presque jamais et représentent le gros du trafic.
              //
              // `statuses: [200]` et non `[0, 200]`, et le nom du cache a changé
              // pour abandonner ce qu'un appareil garde peut-être déjà. Un statut
              // 0 est une réponse opaque : elle se présente comme un succès mais
              // son corps est illisible. Mise en cache par une stratégie
              // « cache d'abord », elle transforme un incident réseau d'une
              // seconde en carte vide pendant trente jours — le style se charge,
              // sa couleur de fond s'affiche, aucune tuile n'arrive jamais, et
              // MapLibre ne signale rien.
              urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'openfreemap-tuiles-v2',
                expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Photos de couverture : une par ville, jamais modifiées sur
              // Commons sous le même nom. Gardées longtemps pour qu'un voyage
              // reste illustré hors ligne, et plafonnées pour ne pas remplir le
              // stockage d'un téléphone avec des villes qu'on ne reverra pas.
              urlPattern: /^https:\/\/[a-z]+\.wikimedia\.org\/.*\.(?:jpe?g|png)/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'tripora-couvertures',
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 180 },
                // Voir les tuiles : une réponse opaque gardée six mois par une
                // stratégie « cache d'abord » est une image morte pour six mois.
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Drapeaux : immuables une fois copiés, gardés longtemps, et
              // disponibles hors ligne dès qu'ils ont été vus une fois.
              urlPattern: /\/flags\/[a-z]{2}\.svg$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'tripora-drapeaux',
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 180 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Ce que le préchargement laisse de côté : morceaux de code
              // chargés à la demande, images lourdes. Leur nom contient une
              // empreinte, donc un fichier gardé ne peut pas être périmé — une
              // version différente a un autre nom. « Cache d'abord » est ici
              // exact, et non un pari.
              urlPattern: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) =>
                sameOrigin && /\/(assets|icons)\/|\.jpe?g$/u.test(url.pathname),
              handler: 'CacheFirst',
              options: {
                cacheName: 'tripora-ressources-v1',
                expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 60 },
                cacheableResponse: { statuses: [200] },
              },
            },
            {
              // Données du voyage : on affiche vite, on rafraîchit derrière.
              urlPattern: /\/rest\/v1\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'tripora-api',
                networkTimeoutSeconds: 6,
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    // MapLibre demande un ouvrier de type module ; Vite doit donc l'émettre
    // comme tel, sinon il retombe sur une variante classique que la
    // bibliothèque recharge ensuite par blob — ce que la CSP refuse.
    worker: { format: 'es' },
    build: {
      outDir: mobile ? 'dist-mobile' : 'dist',
      rollupOptions: {
        output: {
          /**
           * Les dépendances changent rarement, le code de Tripora souvent.
           * Les séparer permet au navigateur — et au Service Worker — de garder
           * React et le client Supabase en cache d'un déploiement à l'autre,
           * au lieu de retélécharger 200 Ko à chaque correction de texte.
           */
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
              return 'react';
            }
            return undefined;
          },
        },
      },
      // MapLibre dépasse à lui seul le seuil, et c'est assumé : il est chargé
      // à la demande par la seule route qui en a besoin.
      chunkSizeWarningLimit: 1100,
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, host: true },
    test: {
      // Deux exécuteurs, deux territoires : Vitest prend les `.test.` de `src`,
      // Playwright les `.spec.` de `e2e`. Sans cette limite, Vitest ramassait
      // les parcours de bout en bout et échouait sur leurs imports, qui
      // n'existent que dans un vrai navigateur.
      include: ['src/**/*.test.{ts,tsx}'],
      /**
       * Les tests unitaires tournent sans serveur, toujours.
       *
       * `apps/web/.env` est versionné — il ne contient que des valeurs
       * publiques — donc sans cette mise à blanc, le client Supabase existe dès
       * qu'on lance les tests depuis le dépôt, et le code qui teste « y a-t-il
       * un serveur ? » part interroger la vraie base. Un test passait alors sur
       * une machine au réseau fermé et échouait en intégration continue, où il
       * atteignait la production pour de bon.
       *
       * Un test qui veut le chemin serveur remplace le module explicitement.
       */
      env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  };
});
