const VERSION = '24751641e154';
const CACHE = 'toubu-pwa-' + VERSION;
const PRECACHE = ["about.html?v=24751641e154","search.html?v=24751641e154","map.html?v=24751641e154","install.html","offline.html","manifest.webmanifest","assets/about.css?v=24751641e154","assets/app.css?v=24751641e154","assets/app.js?v=24751641e154","assets/calendar-districts.css?v=24751641e154","assets/calendar-schedule.js?v=24751641e154","assets/community-app.css?v=24751641e154","assets/community-app.js?v=24751641e154","assets/community-feed.css?v=24751641e154","assets/community-feed.js?v=24751641e154","assets/home.js?v=24751641e154","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=24751641e154","assets/map.js?v=24751641e154","assets/photo-admin.js?v=24751641e154","assets/photo-layout.css?v=24751641e154","assets/pwa.css?v=24751641e154","assets/pwa.js?v=24751641e154","assets/reading.css?v=24751641e154","assets/reading.js?v=24751641e154","assets/reference-theme.css?v=24751641e154","assets/region-sketch.js?v=24751641e154","assets/resident.css?v=24751641e154","assets/search-theme.css?v=24751641e154","assets/search-theme.js?v=24751641e154","assets/site-photos.js?v=24751641e154","data/boundary.js?v=24751641e154","data/districts.js?v=24751641e154","data/resources.js?v=24751641e154","data/site-photos.js?v=24751641e154","data/timeline.js?v=24751641e154"];
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
