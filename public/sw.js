// AuroraWatch Service Worker
// Handles background aurora checks via Periodic Background Sync (Chrome/Edge)
// and notification click routing. Falls back gracefully on unsupported browsers.

const CACHE_NAME = 'aurorawatch-sw-v1';
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const THROTTLE_MS = 30 * 60 * 1000; // 30 min between background alerts

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// Periodic Background Sync — fires even when the browser tab is closed (Chrome/Edge only).
// Falls back to in-tab polling (useNotifications) on other browsers.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'aurora-check') {
    event.waitUntil(checkAurora());
  }
});

async function checkAurora() {
  try {
    const cache = await caches.open(CACHE_NAME);

    // Throttle: skip if we already notified recently
    const lastResponse = await cache.match('/__last_notified');
    const last = lastResponse ? parseInt(await lastResponse.text(), 10) : 0;
    if (Date.now() - last < THROTTLE_MS) return;

    // Load user threshold (written by useNotifications when sensitivity changes)
    const prefsResponse = await cache.match('/__prefs');
    const prefs = prefsResponse
      ? JSON.parse(await prefsResponse.text())
      : { kp: 4, prob: 15 };

    // Fetch live Kp — CSP does not apply to SW fetches
    const res = await fetch(KP_URL, { cache: 'no-store' });
    if (!res.ok) return;

    const raw = await res.json();
    if (!Array.isArray(raw) || raw.length < 2) return;

    // Latest entry is the last element (same convention as lib/noaa.ts `latest()`)
    const entry = raw[raw.length - 1];
    const kp = typeof entry.Kp === 'number' ? entry.Kp : null;
    if (kp === null || kp < prefs.kp) return;

    await self.registration.showNotification('AuroraWatch Alert', {
      body: `Kp ${kp.toFixed(1)} — Aurora may be visible in Michigan. Tap to check conditions.`,
      tag: 'aurorawatch-bg',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: '/' },
    });

    await cache.put('/__last_notified', new Response(String(Date.now())));
  } catch {
    // Silent — network unavailable or SW quota exceeded; will retry next sync interval
  }
}

// Focus the existing tab or open a new one when the user taps a notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
