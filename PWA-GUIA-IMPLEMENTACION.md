# 📱 Guía Completa: Implementación de PWA con Vite y Workbox

_Basado en la implementación de Stability Platform_

## 📋 Índice

1. [Configuración Inicial](#configuración-inicial)
2. [Configuración de Vite](#configuración-de-vite)
3. [Service Worker y Estrategias de Cache](#service-worker-y-estrategias-de-cache)
4. [Registro del Service Worker](#registro-del-service-worker)
5. [HTML y Meta Tags](#html-y-meta-tags)
6. [Splash Screens para iOS](#splash-screens-para-ios)
7. [Problemas Comunes y Soluciones](#problemas-comunes-y-soluciones)
8. [Best Practices](#best-practices)

---

## 🚀 Configuración Inicial

### Instalación de Dependencias

```bash
npm install -D vite-plugin-pwa
```

### Estructura de Archivos

```
src/
├── main.tsx          # Entry point - monta React primero
├── pwa.ts            # Lógica de registro del SW
└── App.tsx

public/
├── pwa-192x192.png   # Ícono PWA
├── pwa-512x512.png   # Ícono PWA
├── logo-stability.png
└── splash/           # Splash screens iOS
    ├── apple-splash-640-1136.png
    ├── apple-splash-750-1334.png
    └── ...
```

---

## ⚙️ Configuración de Vite

**`vite.config.ts`**

```typescript
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      // Habilitar en desarrollo para testing
      devOptions: {
        enabled: true,
        type: "module",
        navigateFallback: "index.html",
      },

      // Assets a incluir en el precache
      includeAssets: [
        "logo-stability.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "splash/*.png",
      ],

      // Manifest de la PWA
      manifest: {
        name: "Tu App Name",
        short_name: "App",
        description: "Descripción de tu app",
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

      // Configuración de Workbox
      workbox: {
        // 🚨 CRÍTICO: Incluir JS y CSS en precache para iOS
        globPatterns: ["**/*.{png,svg,ico,woff2,js,css}", "index.html"],

        cleanupOutdatedCaches: true,

        // Ambos en true: nuevo SW toma control inmediatamente
        clientsClaim: true,
        skipWaiting: true,

        // CRÍTICO para SPA: todas las navegaciones devuelven index.html
        navigateFallback: "index.html",

        // No interceptar requests a APIs externas
        navigateFallbackDenylist: [/^\/api/, /supabase\.co/, /\.well-known/],

        // Estrategias de cache por tipo de recurso
        runtimeCaching: [
          // JS/CSS → StaleWhileRevalidate
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

          // API → NetworkOnly (nunca cachear datos dinámicos)
          {
            urlPattern: ({ url }) => url.origin.includes(".supabase.co"),
            handler: "NetworkOnly",
            options: {
              cacheName: "api-cache",
            },
          },

          // Imágenes → CacheFirst
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
});
```

---

## 🔧 Service Worker y Estrategias de Cache

### Estrategias Disponibles

#### 1. **CacheFirst** (Cache, falling back to network)

- **Uso:** Assets estáticos que cambian poco (imágenes, fuentes)
- **Ventaja:** Máxima velocidad, funciona offline
- **Desventaja:** Actualizaciones lentas

#### 2. **NetworkFirst** (Network, falling back to cache)

- **Uso:** Contenido que debe estar actualizado pero necesita fallback
- **Ventaja:** Datos frescos cuando hay red
- **Desventaja:** Más lento, puede causar race conditions

#### 3. **StaleWhileRevalidate** (Cache first, update in background)

- **Uso:** JS/CSS con hash en el nombre (Vite lo hace automáticamente)
- **Ventaja:** Instantáneo + actualización automática
- **⭐ RECOMENDADO para JS/CSS en Vite**

#### 4. **NetworkOnly**

- **Uso:** APIs, datos dinámicos, autenticación
- **Ventaja:** Siempre datos frescos
- **Desventaja:** No funciona offline

#### 5. **CacheOnly**

- **Uso:** Casos muy específicos, generalmente no recomendado

---

## 📝 Registro del Service Worker

### `src/pwa.ts`

```typescript
import { registerSW } from "virtual:pwa-register";

console.log("[PWA] Iniciando registro del Service Worker...");

// 🚨 IMPORTANTE: NO limpiar SWs anteriores manualmente
// Workbox con skipWaiting + clientsClaim ya maneja el ciclo de vida
iniciarRegistro();

function iniciarRegistro() {
  const updateSW = registerSW({
    immediate: true,

    onNeedRefresh() {
      console.log(
        "[PWA] Nueva versión disponible - aplicando actualización...",
      );
      if (document.readyState === "complete") {
        updateSW(true);
      }
    },

    onOfflineReady() {
      console.log("[PWA] ✅ App lista para funcionar offline");
    },

    onRegisteredSW(swUrl, registration) {
      console.log("[PWA] ✅ Service Worker registrado:", swUrl);
      if (registration) {
        // Chequear actualizaciones cada 5 minutos
        setInterval(
          () => {
            console.log("[PWA] Chequeando actualizaciones del SW...");
            registration.update().catch(() => {});
          },
          5 * 60 * 1000,
        );
      }
    },

    onRegisterError(error) {
      console.error("[PWA] ❌ Error al registrar Service Worker:", error);
    },
  });

  console.log("[PWA] Módulo PWA cargado exitosamente");
}
```

### `src/main.tsx`

```typescript
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// 1️⃣ PRIMERO: Montar React
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 2️⃣ DESPUÉS: Registrar SW de forma asíncrona y no-bloqueante
import("./pwa").catch((error) => {
  console.error("[main.tsx] Error cargando módulo PWA:", error);
  // La app sigue funcionando sin PWA
});
```

**🔑 Clave:** Nunca bloquear el render inicial esperando el SW

---

## 🌐 HTML y Meta Tags

### `index.html` (head section)

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/logo.png" />

    <!-- PWA Meta Tags -->
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    />
    <meta name="theme-color" content="#09090b" />

    <!-- iOS Específico -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta
      name="apple-mobile-web-app-status-bar-style"
      content="black-translucent"
    />
    <link rel="apple-touch-icon" href="/pwa-192x192.png" />

    <!-- Splash screens se añaden aquí (ver siguiente sección) -->
  </head>
</html>
```

---

## 🖼️ Splash Screens para iOS

### ¿Por qué son necesarias?

iOS muestra una pantalla en blanco al abrir la PWA desde el Home Screen. Las splash screens cubren ese gap visual antes de que el WebView ejecute JavaScript.

### Generación Automática

Usa `pwa-asset-generator`:

```bash
npx pwa-asset-generator logo.png ./public/splash \
  --background "#09090b" \
  --splash-only \
  --portrait-only
```

### Implementación en HTML

```html
<!-- iPhone SE (1st gen) 640×1136 -->
<link
  rel="apple-touch-startup-image"
  media="screen and (device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
  href="/splash/apple-splash-640-1136.png"
/>

<!-- iPhone 8, SE (2nd/3rd gen) 750×1334 -->
<link
  rel="apple-touch-startup-image"
  media="screen and (device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
  href="/splash/apple-splash-750-1334.png"
/>

<!-- iPhone X, XS, 11 Pro, 12 mini, 13 mini 1125×2436 -->
<link
  rel="apple-touch-startup-image"
  media="screen and (device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  href="/splash/apple-splash-1125-2436.png"
/>

<!-- iPhone 12, 13, 14 1170×2532 -->
<link
  rel="apple-touch-startup-image"
  media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  href="/splash/apple-splash-1170-2532.png"
/>

<!-- iPhone 14 Pro Max, 15 Plus, 15 Pro Max 1290×2796 -->
<link
  rel="apple-touch-startup-image"
  media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
  href="/splash/apple-splash-1290-2796.png"
/>

<!-- Añadir más tamaños según necesidad -->
```

---

## 🐛 Problemas Comunes y Soluciones

### 1. **Spinner Infinito en iOS** ❌

**Síntoma:** La PWA se queda trabada en la pantalla de carga en iOS.

**Causa:**

- No incluir JS/CSS en el precache (`globPatterns`)
- Limpiar SWs anteriores manualmente, creando un "gap"

**Solución:**

```typescript
// vite.config.ts
globPatterns: ["**/*.{png,svg,ico,woff2,js,css}", "index.html"],

// pwa.ts - NO hacer esto:
// await navigator.serviceWorker.getRegistrations()
//   .then(registrations => registrations.forEach(r => r.unregister()));
```

### 2. **Actualizaciones no se aplican** ❌

**Causa:** Falta `skipWaiting` y `clientsClaim`

**Solución:**

```typescript
workbox: {
  skipWaiting: true,
  clientsClaim: true,
}
```

### 3. **SPA muestra 404 en rutas** ❌

**Causa:** Falta `navigateFallback`

**Solución:**

```typescript
workbox: {
  navigateFallback: "index.html",
  navigateFallbackDenylist: [/^\/api/],
}
```

### 4. **Datos cacheados no se actualizan** ❌

**Causa:** Usar `CacheFirst` para APIs

**Solución:**

```typescript
// APIs siempre NetworkOnly
{
  urlPattern: ({ url }) => url.origin.includes("tu-api.com"),
  handler: "NetworkOnly",
}
```

### 5. **Bundle JS/CSS no carga después de deploy** ❌

**Causa:** iOS limpia caches agresivamente, chunks no precacheados

**Solución:** Usar `StaleWhileRevalidate` para JS/CSS (no `NetworkFirst`):

```typescript
{
  urlPattern: /\.(?:js|css)$/,
  handler: "StaleWhileRevalidate", // ✅
  // NO usar NetworkFirst - causa race conditions en iOS
}
```

---

## ✅ Best Practices

### 1. **Orden de Inicialización**

```typescript
// ✅ Correcto
1. Montar React
2. Registrar SW (async, no-bloqueante)

// ❌ Incorrecto
1. Esperar SW
2. Montar React
```

### 2. **Estrategias por Tipo de Recurso**

| Recurso  | Estrategia           | Razón                                    |
| -------- | -------------------- | ---------------------------------------- |
| HTML     | Precache             | SPA necesita index.html siempre          |
| JS/CSS   | StaleWhileRevalidate | Vite usa hashes, actualiza en background |
| Imágenes | CacheFirst           | Cambian poco, máxima velocidad           |
| APIs     | NetworkOnly          | Datos dinámicos, nunca cachear           |
| Fuentes  | CacheFirst           | Inmutables, gran beneficio offline       |

### 3. **iOS Específico**

- ✅ Siempre incluir splash screens
- ✅ Usar `apple-mobile-web-app-capable`
- ✅ Precachear JS/CSS (iOS limpia caches agresivamente)
- ❌ NO limpiar SWs manualmente
- ❌ NO usar intervalos de actualización muy agresivos (< 5 min)

### 4. **Debugging**

```typescript
// Logs detallados para debugging
console.log("[PWA] Estado:", {
  swRegistered: !!registration,
  swActive: navigator.serviceWorker.controller,
  cacheActive: await caches.keys(),
});
```

### 5. **Testing**

```bash
# Build y preview local
npm run build
npm run preview

# Chrome DevTools → Application
- Service Workers (estado, eventos)
- Cache Storage (contenido)
- Manifest (validación)

# iOS Safari
- Web Inspector (Mac required)
- Simulador iOS
```

### 6. **Precache vs Runtime Cache**

```typescript
// ✅ Precache (globPatterns)
- index.html
- JS/CSS chunks
- Assets críticos (logos, iconos)
- Fuentes

// ✅ Runtime Cache (runtimeCaching)
- Imágenes de usuario
- APIs externas
- Google Fonts
- Contenido dinámico
```

### 7. **Cache Cleanup**

```typescript
workbox: {
  cleanupOutdatedCaches: true, // ✅ Siempre habilitar
  expiration: {
    maxEntries: 100,          // Límite de items
    maxAgeSeconds: 30 * 24 * 60 * 60, // TTL
  },
}
```

---

## 📦 Build y Deploy

### Build

```bash
npm run build
```

**Generará:**

- `dist/sw.js` - Service Worker
- `dist/workbox-*.js` - Runtime de Workbox
- `dist/registerSW.js` - Código de registro
- `dist/manifest.webmanifest` - Manifest de la PWA

### Verificar

```bash
# Preview local
npm run preview

# Chrome DevTools
1. Application → Manifest (debe aparecer)
2. Application → Service Workers (debe estar activo)
3. Application → Cache Storage (debe tener contenido)
4. Lighthouse → PWA score
```

### Deploy Consideraciones

- ✅ HTTPS es obligatorio (excepto localhost)
- ✅ Configurar headers correctos para SW:
  ```
  /sw.js
    Cache-Control: no-cache
  ```
- ✅ Test en diferentes dispositivos (iOS, Android)
- ✅ Verificar que el manifest sea accesible

---

## 🎯 Checklist Final

- [ ] `vite-plugin-pwa` instalado
- [ ] `globPatterns` incluye `js` y `css`
- [ ] `skipWaiting: true` y `clientsClaim: true`
- [ ] `navigateFallback: "index.html"` configurado
- [ ] Runtime caching apropiado por tipo de recurso
- [ ] APIs configuradas como `NetworkOnly`
- [ ] SW se registra de forma asíncrona en `main.tsx`
- [ ] Meta tags de iOS presentes
- [ ] Splash screens generadas y linkeadas
- [ ] Íconos PWA (192x192, 512x512)
- [ ] Manifest completo y válido
- [ ] Tested en iOS Safari
- [ ] Tested en Chrome Android
- [ ] Lighthouse PWA score > 90

---

## 📚 Recursos Adicionales

- [vite-plugin-pwa Docs](https://vite-pwa-org.netlify.app/)
- [Workbox Strategies](https://developer.chrome.com/docs/workbox/modules/workbox-strategies/)
- [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator)
- [Web.dev PWA Guide](https://web.dev/progressive-web-apps/)

---

**🚀 Con esta guía, tienes todo lo necesario para implementar una PWA robusta que funcione perfectamente en iOS y Android.**
