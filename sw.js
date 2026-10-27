// YAVIS: Minimaler Service Worker. Er macht die App auf dem Handy installierbar, speichert aber bewusst NICHTS zwischen,
// damit immer die neueste Fassung von index.html geladen wird (kein Veraltet-Problem wie beim Browser-Cache).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* Netz wie gewohnt */ });
