// =====================================================================
// Avisos no celular do Portal de Leads (service worker).
// Este arquivo fica na raiz do site e "acorda" o celular quando chega um aviso,
// mesmo com o portal fechado. Ele não guarda páginas nem dados: só mostra o aviso
// e abre o portal quando a pessoa toca nele.
// =====================================================================
self.window = self; // o config.js foi escrito para a página (window.PORTAL_CONFIG)
importScripts("https://cdn.jsdelivr.net/npm/firebase@12.4.0/firebase-app-compat.js");
importScripts("https://cdn.jsdelivr.net/npm/firebase@12.4.0/firebase-messaging-compat.js");
importScripts("config.js");

const cfg = self.PORTAL_CONFIG || {};
if (cfg.firebase && cfg.firebase.apiKey) {
  firebase.initializeApp(cfg.firebase);
  // Com o portal fechado, o próprio Firebase mostra o aviso (título, texto e ícone vêm do robô).
  firebase.messaging();
}

// Tocar no aviso: abre o portal (ou traz para a frente, se já estiver aberto).
self.addEventListener("notificationclick", (ev) => {
  const link = (ev.notification && ev.notification.data && ev.notification.data.FCM_MSG && ev.notification.data.FCM_MSG.fcmOptions && ev.notification.data.FCM_MSG.fcmOptions.link) || "./";
  ev.notification.close();
  ev.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
    for (const c of abertas) if ("focus" in c) return c.focus();
    return clients.openWindow(link);
  }));
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (ev) => ev.waitUntil(self.clients.claim()));
