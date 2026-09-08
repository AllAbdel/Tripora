import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
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
        // Les 147 drapeaux pèsent un mégaoctet à eux seuls, presque tout dû à
        // une vingtaine d'armoiries détaillées. Les précharger ferait payer à
        // tout le monde, à l'installation, des images que chacun ne verra que
        // par poignées. Ils sont mis en cache au fil de l'affichage.
        globIgnores: ['**/flags/*.svg'],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Tuiles de carte : réutilisées agressivement, elles ne changent
            // presque jamais et représentent le gros du trafic.
            urlPattern: /^https:\/\/tiles\.openfreemap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openfreemap-tiles',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
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
              cacheableResponse: { statuses: [0, 200] },
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
              cacheableResponse: { statuses: [0, 200] },
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
  build: {
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
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
