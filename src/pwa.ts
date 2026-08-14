import { registerSW } from "virtual:pwa-register";

console.log("[PWA] Iniciando registro del Service Worker...");

// Registrar SW directamente — Workbox con skipWaiting + clientsClaim
// ya maneja el ciclo de vida correctamente. NO limpiar SWs anteriores
// porque crea un gap donde las requests quedan sin resolver en iOS.
iniciarRegistro();

function iniciarRegistro() {
  const updateSW = registerSW({
    immediate: true,

    onNeedRefresh() {
      console.log("[PWA] Nueva versión disponible - aplicando actualización...");
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
        // Chequear actualizaciones cada 5 minutos (menos agresivo para iOS)
        setInterval(() => {
          console.log("[PWA] Chequeando actualizaciones del SW...");
          registration.update().catch(() => { });
        }, 5 * 60 * 1000);
      }
    },

    onRegisterError(error) {
      console.error("[PWA] ❌ Error al registrar Service Worker:", error);
    },
  });

  console.log("[PWA] Módulo PWA cargado exitosamente");
}
