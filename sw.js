const VERSION = '9b7a7c9b76ca';
const CACHE = 'toubu-pwa-' + VERSION;
const PRECACHE = ["about.html?v=9b7a7c9b76ca","search.html?v=9b7a7c9b76ca","map.html?v=9b7a7c9b76ca","install.html","offline.html","manifest.webmanifest","assets/about.css?v=9b7a7c9b76ca","assets/app.css?v=9b7a7c9b76ca","assets/app.js?v=9b7a7c9b76ca","assets/calendar-districts.css?v=9b7a7c9b76ca","assets/calendar-schedule.js?v=9b7a7c9b76ca","assets/community-app.css?v=9b7a7c9b76ca","assets/community-app.js?v=9b7a7c9b76ca","assets/community-feed.css?v=9b7a7c9b76ca","assets/community-feed.js?v=9b7a7c9b76ca","assets/home.js?v=9b7a7c9b76ca","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=9b7a7c9b76ca","assets/map.js?v=9b7a7c9b76ca","assets/photo-admin.js?v=9b7a7c9b76ca","assets/photo-layout.css?v=9b7a7c9b76ca","assets/pwa.css?v=9b7a7c9b76ca","assets/pwa.js?v=9b7a7c9b76ca","assets/reading.css?v=9b7a7c9b76ca","assets/reading.js?v=9b7a7c9b76ca","assets/reference-theme.css?v=9b7a7c9b76ca","assets/region-sketch.js?v=9b7a7c9b76ca","assets/resident.css?v=9b7a7c9b76ca","assets/search-theme.css?v=9b7a7c9b76ca","assets/search-theme.js?v=9b7a7c9b76ca","assets/site-photos.js?v=9b7a7c9b76ca","data/boundary.js?v=9b7a7c9b76ca","data/districts.js?v=9b7a7c9b76ca","data/resources.js?v=9b7a7c9b76ca","data/site-photos.js?v=9b7a7c9b76ca","data/timeline.js?v=9b7a7c9b76ca"];
const scopedURL = file => new URL(file, self.registration.scope).href;
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(scopedURL)))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('toubu-pwa-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope) || url.pathname.includes('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try { const response = await fetch(request); if(response.ok){const cache=await caches.open(CACHE);await cache.put(url.pathname,response.clone());} return response; }
      catch { const cache=await caches.open(CACHE); const savedPage=PRECACHE.find(f=>new URL(f,self.registration.scope).pathname===url.pathname); return await cache.match(url.pathname) || (savedPage && await cache.match(scopedURL(savedPage))) || await cache.match(scopedURL('offline.html')); }
    })());
  } else if (/\.(?:js|css|png|svg|webp|jpg|webmanifest)$/.test(url.pathname)) {
    event.respondWith((async () => {
      const cache=await caches.open(CACHE), saved=await cache.match(request); if(saved) return saved;
      const response=await fetch(request); if(response.ok) await cache.put(request,response.clone()); return response;
    })());
  }
});
