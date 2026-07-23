const CACHE = "metro-kyiv-v5";
const ALERT_CACHE = "metro-kyiv-alert-state";
const CORE = [
  "/",
  "/manifest.webmanifest",
  "/metro-logo.svg",
  "/og-v2.png",
  "/transit-network.json",
  "/kyiv-metro-map-v1.12.3.png",
  "/kyiv-metro-map-v1.12.3.pdf",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === "/api/realtime") {
    event.respondWith(fetch(event.request));
    return;
  }

  if (url.pathname === "/api/alerts") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});

async function checkTransportAlerts() {
  const response = await fetch("/api/alerts", { cache: "no-store" });
  if (!response.ok) return;
  const payload = await response.json();
  const latest = payload.alerts?.[0];
  if (!latest) return;

  const cache = await caches.open(ALERT_CACHE);
  const saved = await cache.match("/__last-transport-alert");
  const previousId = saved ? await saved.text() : "";
  await cache.put("/__last-transport-alert", new Response(latest.id));
  if (!previousId || previousId === latest.id) return;

  await self.registration.showNotification(latest.title, {
    body: latest.text.slice(0, 180),
    icon: "/metro-logo.svg",
    badge: "/metro-logo.svg",
    tag: `transport-${latest.id}`,
    data: { url: latest.url || "/?view=city" },
  });
}

self.addEventListener("periodicsync", (event) => {
  if (event.tag === "transport-alerts") {
    event.waitUntil(checkTransportAlerts());
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = { body: event.data?.text?.() || "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Зміни в роботі транспорту", {
      body: payload.body || "Відкрийте Metro Kyiv, щоб переглянути деталі.",
      icon: "/metro-logo.svg",
      badge: "/metro-logo.svg",
      tag: payload.tag || "transport-update",
      data: { url: payload.url || "/?view=city" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/?view=city"));
});
