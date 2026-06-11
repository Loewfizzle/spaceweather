// SkyGlow Service Worker — source file.
// Bundled into public/sw.js by `node scripts/buildSw.js` (runs as part of npm run build).
// Edit this file, not public/sw.js.

import { parseKpFromTabular, shouldTriggerNotification } from '../lib/utils/swShared.js';

const CACHE_NAME = 'skyglow-sw-v1';
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const THROTTLE_MS = 30 * 60 * 1000;       // 30 min between background alerts
const STATE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // cached Bz / maxProb valid for 2 hours
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// Intercept navigation requests and serve the offline page if the network fails.
// Only handles document navigations (HTML page loads); API/asset requests are ignored.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return cache.match(OFFLINE_URL);
    })
  );
});

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
    const kp = parseKpFromTabular(raw);
    if (kp === null) return;

    if (!shouldTriggerNotification(kp, prefs, cachedBz, cachedMaxProb)) return;

    const kpHit   = kp >= prefs.kp;
    const probHit = cachedMaxProb !== null && cachedMaxProb >= prefs.prob;
    const bzHit   = cachedBz !== null && cachedBz <= -5;

    // Build a descriptive body listing every factor that triggered
    const reasons = [];
    if (kpHit)   reasons.push(`Kp ${kp.toFixed(1)}`);
    if (probHit) reasons.push(`${Math.round(cachedMaxProb)}% probability`);
    if (bzHit)   reasons.push(`Bz ${cachedBz.toFixed(1)} nT`);
    const body = `${reasons.join(' · ')} — Aurora may be visible across the northern US. Tap to check conditions.`;

    await self.registration.showNotification('SkyGlow Alert', {
      body,
      tag: 'skyglow-bg',
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
