import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Optimizar imágenes ANTES de VitePWA para que Workbox use los assets ya comprimidos
    ViteImageOptimizer({
      png: { quality: 80 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
      webp: { lossless: false, quality: 80 },
    }),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },
      includeAssets: [
        "logo-stability.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "splash/*.png",
      ],
      manifest: {
        name: "Stability Platform",
        short_name: "Stability",
        description: "Plataforma de entrenamiento y gestión",
        theme_color: "#09090b",
        background_color: "#09090b",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Solo precachear assets estáticos e index.html (necesario para navigateFallback)
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        cleanupOutdatedCaches: true,
        // Ambos en true: nuevo SW toma control inmediatamente
        clientsClaim: true,
        skipWaiting: true,
        // CRÍTICO para SPA: todas las navegaciones devuelven index.html
        navigateFallback: "index.html",
        // No interceptar requests a Supabase ni API
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/, /\.well-known/],
        runtimeCaching: [
          // JS/CSS → StaleWhileRevalidate: sirve desde cache instantáneamente
          // y actualiza en segundo plano. Evita el bucle de recargas en iOS
          // donde NetworkFirst + timeout causaba mismatch entre HTML y chunks cacheados.
          // Los chunks Vite ya tienen hash en el nombre → cache-busting automático.
          {
            urlPattern: /\.(?:js|css)$/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 días
              },
            },
          },
          // Supabase API → NetworkOnly: nunca cachear datos
          {
            urlPattern: ({ url }) => url.origin.includes(".supabase.co"),
            handler: "NetworkOnly",
            options: {
              cacheName: "api-cache",
            },
          },
          // Imágenes → CacheFirst: cachear agresivamente
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
              },
            },
          },
          // Google Fonts stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
            },
          },
          // Google Fonts webfonts
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 año
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    allowedHosts: ['.ngrok-free.dev'],
  },
  esbuild: {
    drop: mode === "production" ? (["console", "debugger"] as const) : [],
  },
  build: {
    // Inject <link rel="modulepreload"> for critical chunks in production HTML
    modulePreload: { polyfill: true },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — always loaded, keep small and isolated
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-is/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          // Supabase — always loaded (auth init)
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }
          // Router
          if (id.includes("node_modules/react-router")) {
            return "vendor-router";
          }
          // Forms + validation — login/register pages
          if (
            id.includes("node_modules/react-hook-form/") ||
            id.includes("node_modules/@hookform/") ||
            id.includes("node_modules/zod/")
          ) {
            return "vendor-forms";
          }
          // Charts — only BusinessMetrics page
          if (id.includes("node_modules/recharts/")) {
            return "vendor-charts";
          }
          // PDF / canvas export — only Library page
          if (
            id.includes("node_modules/jspdf/") ||
            id.includes("node_modules/html2canvas/")
          ) {
            return "vendor-pdf";
          }
          // DnD — only NewPlan page
          if (id.includes("node_modules/@dnd-kit/")) {
            return "vendor-dnd";
          }
          // UI utilities (lucide, radix, class utils, sonner, zustand)
          if (
            id.includes("node_modules/lucide-react/") ||
            id.includes("node_modules/@radix-ui/") ||
            id.includes("node_modules/clsx/") ||
            id.includes("node_modules/tailwind-merge/") ||
            id.includes("node_modules/class-variance-authority/") ||
            id.includes("node_modules/sonner/") ||
            id.includes("node_modules/zustand/")
          ) {
            return "vendor-ui";
          }
        },
      },
    },
  },
}));
