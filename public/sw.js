// Zeflo's service worker. It only shows reminders: nothing is cached, so the app always loads
// fresh from the network. Each push carries {title, body, url, tag} (see app/lib/push.ts).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let notice = {};
  try {
    notice = event.data ? event.data.json() : {};
  } catch {
    // Not JSON: show what we can rather than nothing (phones penalise silent pushes).
  }
  event.waitUntil(
    self.registration.showNotification(notice.title || "Zeflo", {
      body: notice.body || "",
      icon: "/icon-192.png",
      badge: "/badge.png",
      tag: notice.tag, // the same reminder twice replaces itself
      data: {url: notice.url || "/"},
    }),
  );
});

// Tapping a reminder opens Zeflo, or brings an open Zeflo forward on the right page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({type: "window", includeUncontrolled: true}).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then((w) => (w && w.url !== url ? w.navigate(url) : w));
      return self.clients.openWindow(url);
    }),
  );
});
