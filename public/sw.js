// AuroraWatch Service Worker
// Handles background aurora checks via Periodic Background Sync (Chrome/Edge)
// and notification click routing. Falls back gracefully on unsupported browsers.

const CACHE_NAME = 'aurorawatch-sw-v1';
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const THROTTLE_MS = 30 * 60 * 1000;      // 30 min between background alerts
const STATE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // cached Bz / maxProb valid for 2 hours

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

    // Load user thresholds (written by saveSensitivity when user changes sensitivity)
    const prefsResponse = await cache.match('/__prefs');
    const prefs = prefsResponse
      ? JSON.parse(await prefsResponse.text())
      : { kp: 4, prob: 15 };

    // Load cached live state written by syncLiveStateToSw() on every in-tab data refresh.
    // Treat as stale if written more than 2 hours ago; fall back to Kp-only in that case.
    const stateResponse = await cache.match('/__state');
    let cachedBz = null;
    let cachedMaxProb = null;
    if (stateResponse) {
      const state = JSON.parse(await stateResponse.text());
      const age = Date.now() - (state.updatedAt ?? 0);
      if (age < STATE_MAX_AGE_MS) {
        cachedBz = typeof state.bz === 'number' ? state.bz : null;
        cachedMaxProb = typeof state.maxProb === 'number' ? state.maxProb : null;
      }
    }

    // Fetch live Kp — CSP does not apply to SW fetches
    const res = await fetch(KP_URL, { cache: 'no-store' });
    if (!res.ok) return;

    const raw = await res.json();

    // NOAA returns string[][] (header row + data rows); find the Kp column index
    // from the header then read the last (most-recent) data row.
    // Same logic as lib/utils/swKpParsing.ts — mirrored here because SW has no imports.
    function parseKpFromTabular(data) {
      if (!Array.isArray(data) || data.length < 2) return null;
      const headers = data[0];
      if (!Array.isArray(headers)) return null;
      const kpColIdx = headers.indexOf('Kp');
      if (kpColIdx === -1) return null;
      const lastRow = data[data.length - 1];
      if (!Array.isArray(lastRow)) return null;
      const kp = parseFloat(String(lastRow[kpColIdx]));
      return isNaN(kp) ? null : kp;
    }

    const kp = parseKpFromTabular(raw);
    if (kp === null) return;

    // Multi-factor condition — mirrors the likelyForMI logic in useNotifications.ts
    const kpHit   = kp >= prefs.kp;
    const probHit  = cachedMaxProb !== null && cachedMaxProb >= prefs.prob;
    const bzHit    = cachedBz !== null && cachedBz <= -5;
    if (!kpHit && !probHit && !bzHit) return;

    // Build a descriptive body listing every factor that triggered
    const reasons = [];
    if (kpHit)   reasons.push(`Kp ${kp.toFixed(1)}`);
    if (probHit) reasons.push(`${Math.round(cachedMaxProb)}% probability`);
    if (bzHit)   reasons.push(`Bz ${cachedBz.toFixed(1)} nT`);
    const body = `${reasons.join(' · ')} — Aurora may be visible across the northern US. Tap to check conditions.`;

    await self.registration.showNotification('AuroraWatch Alert', {
      body,
      tag: 'aurorawatch-bg',
      icon: '/api/pwa-icon?size=192',
      badge: '/api/pwa-icon?size=192',
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
