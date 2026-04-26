// Self-destructing service worker.
// The old Serwist build was caching all JS chunks (StaleWhileRevalidate)
// causing stale bundles to survive hard refreshes. This replacement wipes
// every cache entry and unregisters itself so the browser fetches everything fresh.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', async () => {
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
  await self.registration.unregister();
  // Force all open tabs to reload so they pick up the fresh JS
  const clients = await self.clients.matchAll({ type: 'window' });
  clients.forEach(c => c.navigate(c.url));
});
