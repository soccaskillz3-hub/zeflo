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
  // The user's own reminders (kind "reminder") stay on screen until they're dealt with, and
  // buzz even when one with the same tag is already showing.
  const own = notice.kind === "reminder";
  // A session reminder that arrives late (the device was asleep) says what's true now.
  if (typeof notice.startsAt === "number" && notice.time) {
    const minutes = Math.round((notice.startsAt - Date.now()) / 60000);
    notice.body =
      minutes > 0
        ? `Starts in ${minutes} ${minutes === 1 ? "minute" : "minutes"}, at ${notice.time}.`
        : minutes === 0
          ? `Starting now, at ${notice.time}.`
          : `Started at ${notice.time}.`;
  }
  event.waitUntil(
    self.registration.showNotification(notice.title || "Zeflo", {
      body: notice.body || "",
      icon: "/icon-192.png",
      badge: "/badge.png",
      tag: notice.tag, // the same reminder twice replaces itself
      data: {url: notice.url || "/"},
      ...(own && {requireInteraction: true, renotify: true, vibrate: [120, 60, 120]}),
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
      if (open) {
        return open
          .focus()
          .then((w) => (w && w.url !== url ? w.navigate(url) : w))
          .catch(() => self.clients.openWindow(url)); // a window this worker doesn't control yet
      }
      return self.clients.openWindow(url);
    }),
  );
});
