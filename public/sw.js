/* Carevanta patient app service worker.
 *
 * Responsibilities, deliberately small:
 *  1. Keep the app shell's static assets cached so the installed app opens fast
 *     and shows a friendly page when offline. API calls are never cached:
 *     bookings, stock and dispatch must always be live.
 *  2. Turn Web Push messages into system notifications and open the right
 *     page when one is tapped.
 */
const VERSION = 'v1';
const SHELL = `carevanta-patient-${VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/logo.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API lives on another origin; never touch it.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icon-') || url.pathname === '/logo.png') {
    // Hashed build assets: cache first, fill on miss.
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  if (req.mode === 'navigate') {
    // Pages: network first; the offline page only when the network is gone.
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});

self.addEventListener('push', (event) => {
  let data = { title: 'Carevanta', body: '', link: '/', tag: 'carevanta', urgent: false };
  try { data = { ...data, ...event.data.json() }; } catch { /* plain text or empty push */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag,
    renotify: true,
    requireInteraction: !!data.urgent,
    vibrate: data.urgent ? [200, 100, 200, 100, 400] : [100],
    data: { link: data.link },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';
  const target = new URL(link, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => c.url.startsWith(self.location.origin));
    if (open) { open.focus(); return open.navigate ? open.navigate(target) : undefined; }
    return self.clients.openWindow(target);
  }));
});
