const VERSION = '3d8555a467be';
const CACHE = 'toubu-pwa-' + VERSION;
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["about.html?v=3d8555a467be","search.html?v=3d8555a467be","map.html?v=3d8555a467be","install.html","offline.html","manifest.webmanifest","find.html?v=3d8555a467be","calendar.html?v=3d8555a467be","support.html?v=3d8555a467be","support-personal.html?v=3d8555a467be","support-corporate.html?v=3d8555a467be","guide.html?v=3d8555a467be","participate.html?v=3d8555a467be","activities.html?v=3d8555a467be","information.html?v=3d8555a467be","assets/about.css?v=3d8555a467be","assets/app.css?v=3d8555a467be","assets/app.js?v=3d8555a467be","assets/calendar-districts.css?v=3d8555a467be","assets/calendar-schedule.js?v=3d8555a467be","assets/community-app.css?v=3d8555a467be","assets/community-app.js?v=3d8555a467be","assets/community-feed.css?v=3d8555a467be","assets/community-feed.js?v=3d8555a467be","assets/community-preferences.js?v=3d8555a467be","assets/highland-ridge.svg","assets/highland-theme.css?v=3d8555a467be","assets/home.js?v=3d8555a467be","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=3d8555a467be","assets/map.js?v=3d8555a467be","assets/photo-admin.js?v=3d8555a467be","assets/photo-layout.css?v=3d8555a467be","assets/profile-header.js?v=3d8555a467be","assets/pwa.css?v=3d8555a467be","assets/pwa.js?v=3d8555a467be","assets/reading.css?v=3d8555a467be","assets/reading.js?v=3d8555a467be","assets/reference-theme.css?v=3d8555a467be","assets/region-sketch.js?v=3d8555a467be","assets/resident.css?v=3d8555a467be","assets/search-theme.css?v=3d8555a467be","assets/search-theme.js?v=3d8555a467be","assets/section-navigation.css?v=3d8555a467be","assets/site-photos.js?v=3d8555a467be","data/boundary.js?v=3d8555a467be","data/districts.js?v=3d8555a467be","data/resources.js?v=3d8555a467be","data/site-photos.js?v=3d8555a467be","data/timeline.js?v=3d8555a467be"];
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
