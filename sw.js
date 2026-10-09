const VERSION = '6c0511d69ef7';
const CACHE = 'toubu-pwa-' + VERSION;
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["about.html?v=6c0511d69ef7","search.html?v=6c0511d69ef7","map.html?v=6c0511d69ef7","install.html","offline.html","manifest.webmanifest","find.html?v=6c0511d69ef7","calendar.html?v=6c0511d69ef7","support.html?v=6c0511d69ef7","support-personal.html?v=6c0511d69ef7","support-corporate.html?v=6c0511d69ef7","guide.html?v=6c0511d69ef7","participate.html?v=6c0511d69ef7","activities.html?v=6c0511d69ef7","information.html?v=6c0511d69ef7","assets/about.css?v=6c0511d69ef7","assets/app.css?v=6c0511d69ef7","assets/app.js?v=6c0511d69ef7","assets/calendar-districts.css?v=6c0511d69ef7","assets/calendar-schedule.js?v=6c0511d69ef7","assets/community-app.css?v=6c0511d69ef7","assets/community-app.js?v=6c0511d69ef7","assets/community-feed.css?v=6c0511d69ef7","assets/community-feed.js?v=6c0511d69ef7","assets/community-preferences.js?v=6c0511d69ef7","assets/highland-ridge.svg","assets/highland-theme.css?v=6c0511d69ef7","assets/home.js?v=6c0511d69ef7","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=6c0511d69ef7","assets/map.js?v=6c0511d69ef7","assets/photo-admin.js?v=6c0511d69ef7","assets/photo-layout.css?v=6c0511d69ef7","assets/profile-header.js?v=6c0511d69ef7","assets/pwa.css?v=6c0511d69ef7","assets/pwa.js?v=6c0511d69ef7","assets/reading.css?v=6c0511d69ef7","assets/reading.js?v=6c0511d69ef7","assets/reference-theme.css?v=6c0511d69ef7","assets/region-sketch.js?v=6c0511d69ef7","assets/resident.css?v=6c0511d69ef7","assets/scroll-header.js?v=6c0511d69ef7","assets/search-theme.css?v=6c0511d69ef7","assets/search-theme.js?v=6c0511d69ef7","assets/section-navigation.css?v=6c0511d69ef7","assets/site-photos.js?v=6c0511d69ef7","data/boundary.js?v=6c0511d69ef7","data/districts.js?v=6c0511d69ef7","data/resources.js?v=6c0511d69ef7","data/site-photos.js?v=6c0511d69ef7","data/timeline.js?v=6c0511d69ef7"];
const scopedURL = file => new URL(file, self.registration.scope).href;
self.addEventListener('install', event => event.waitUntil(DEVELOPMENT ? self.skipWaiting() : caches.open(CACHE).then(cache => cache.addAll(PRECACHE.map(scopedURL)))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith('toubu-pwa-') && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  if (DEVELOPMENT) return;
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
