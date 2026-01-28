/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/getEmails': {
          target: 'https://us-central1-bel-air-habitat.cloudfunctions.net',
          changeOrigin: true,
          secure: false,
        },
        '/sendEmail': {
          target: 'https://us-central1-bel-air-habitat.cloudfunctions.net',
          changeOrigin: true,
          secure: false,
        },
        '/webmail': {
          target: 'https://us-central1-bel-air-habitat.cloudfunctions.net',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/webmail/, '/proxyWebmail'), // Map local /webmail to remote function name if needed, or just let it hit the function if the function handles the path.
          // Wait, the Cloud Function is named 'proxyWebmail'.
          // If we send request to https://us-central1.../webmail, it will 404 unless we rewrite to the function name.
          // The rewrite in firebase.json maps /webmail/** -> proxyWebmail function.
          // Direct HTTP call to function needs the function name.
          // https://us-central1-bel-air-habitat.cloudfunctions.net/proxyWebmail
        },
      },
    },
    plugins: [
      react(),
      // Fix: Activer PWA uniquement si DISABLE_PWA n'est pas défini
      // Le build fonctionne même si le service worker échoue (fichiers générés)
      ...(process.env.DISABLE_PWA !== 'true'
        ? [
            VitePWA({
              selfDestroying: true,
              registerType: 'autoUpdate',
              manifestFilename: 'manifest.json',
              injectManifest: {
                injectionPoint: undefined,
              },
              includeAssets: ['favicon.ico', 'logo.png', 'logo-high-res.png'],
              manifest: {
                name: 'Bel Air Habitat - Espace Pro',
                short_name: 'Bel Air Pro',
                description: 'Application de gestion de chantier pour Bel Air Habitat',
                theme_color: '#10b981',
                background_color: '#0f172a',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                scope: '/',
                icons: [
                  {
                    src: 'pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                  },
                  {
                    src: 'pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2}'],
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                navigateFallback: '/index.html',
                navigateFallbackDenylist: [/^\/webmail/],
                runtimeCaching: [
                  {
                    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'google-fonts-cache',
                      expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                      },
                      cacheableResponse: {
                        statuses: [0, 200],
                      },
                    },
                  },
                  {
                    urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'gstatic-fonts-cache',
                      expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                      },
                      cacheableResponse: {
                        statuses: [0, 200],
                      },
                    },
                  },
                  {
                    urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
                    handler: 'StaleWhileRevalidate',
                    options: {
                      cacheName: 'firebase-storage-images',
                      expiration: {
                        maxEntries: 50,
                        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                      },
                    },
                  },
                ],
              },
            }),
          ]
        : []),
    ],
    define: {
      // Inject environment variables for production build
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.VITE_FIREBASE_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(env.VITE_FIREBASE_API_KEY),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(env.VITE_FIREBASE_APP_ID),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        env.VITE_FIREBASE_MESSAGING_SENDER_ID
      ),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(
        env.VITE_FIREBASE_STORAGE_BUCKET
      ),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-firebase': [
              'firebase/app',
              'firebase/auth',
              'firebase/firestore',
              'firebase/storage',
            ],
            'vendor-icons': ['lucide-react'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
    },
  };
});
