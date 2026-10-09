const VERSION = '65d15e626ade';
const CACHE = 'toubu-pwa-' + VERSION;
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["about.html?v=65d15e626ade","search.html?v=65d15e626ade","map.html?v=65d15e626ade","install.html","offline.html","manifest.webmanifest","find.html?v=65d15e626ade","calendar.html?v=65d15e626ade","support.html?v=65d15e626ade","support-personal.html?v=65d15e626ade","support-corporate.html?v=65d15e626ade","guide.html?v=65d15e626ade","participate.html?v=65d15e626ade","activities.html?v=65d15e626ade","information.html?v=65d15e626ade","assets/about.css?v=65d15e626ade","assets/app.css?v=65d15e626ade","assets/app.js?v=65d15e626ade","assets/calendar-districts.css?v=65d15e626ade","assets/calendar-schedule.js?v=65d15e626ade","assets/community-app.css?v=65d15e626ade","assets/community-app.js?v=65d15e626ade","assets/community-feed.css?v=65d15e626ade","assets/community-feed.js?v=65d15e626ade","assets/community-preferences.js?v=65d15e626ade","assets/highland-ridge.svg","assets/highland-theme.css?v=65d15e626ade","assets/home.js?v=65d15e626ade","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=65d15e626ade","assets/map.js?v=65d15e626ade","assets/photo-admin.js?v=65d15e626ade","assets/photo-layout.css?v=65d15e626ade","assets/profile-header.js?v=65d15e626ade","assets/pwa.css?v=65d15e626ade","assets/pwa.js?v=65d15e626ade","assets/reading.css?v=65d15e626ade","assets/reading.js?v=65d15e626ade","assets/reference-theme.css?v=65d15e626ade","assets/region-sketch.js?v=65d15e626ade","assets/resident.css?v=65d15e626ade","assets/scroll-header.js?v=65d15e626ade","assets/search-theme.css?v=65d15e626ade","assets/search-theme.js?v=65d15e626ade","assets/section-navigation.css?v=65d15e626ade","assets/site-photos.js?v=65d15e626ade","data/boundary.js?v=65d15e626ade","data/districts.js?v=65d15e626ade","data/resources.js?v=65d15e626ade","data/site-photos.js?v=65d15e626ade","data/timeline.js?v=65d15e626ade"];
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
