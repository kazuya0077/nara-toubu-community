const VERSION = '76f993aea3ac';
const CACHE = 'toubu-pwa-' + VERSION;
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["about.html?v=76f993aea3ac","search.html?v=76f993aea3ac","map.html?v=76f993aea3ac","install.html","offline.html","manifest.webmanifest","find.html?v=76f993aea3ac","calendar.html?v=76f993aea3ac","support.html?v=76f993aea3ac","support-personal.html?v=76f993aea3ac","support-corporate.html?v=76f993aea3ac","guide.html?v=76f993aea3ac","participate.html?v=76f993aea3ac","activities.html?v=76f993aea3ac","information.html?v=76f993aea3ac","assets/about.css?v=76f993aea3ac","assets/app.css?v=76f993aea3ac","assets/app.js?v=76f993aea3ac","assets/calendar-districts.css?v=76f993aea3ac","assets/calendar-schedule.js?v=76f993aea3ac","assets/community-app.css?v=76f993aea3ac","assets/community-app.js?v=76f993aea3ac","assets/community-feed.css?v=76f993aea3ac","assets/community-feed.js?v=76f993aea3ac","assets/community-preferences.js?v=76f993aea3ac","assets/highland-ridge.svg","assets/highland-theme.css?v=76f993aea3ac","assets/home.js?v=76f993aea3ac","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=76f993aea3ac","assets/map.js?v=76f993aea3ac","assets/photo-admin.js?v=76f993aea3ac","assets/photo-layout.css?v=76f993aea3ac","assets/profile-header.js?v=76f993aea3ac","assets/pwa.css?v=76f993aea3ac","assets/pwa.js?v=76f993aea3ac","assets/reading.css?v=76f993aea3ac","assets/reading.js?v=76f993aea3ac","assets/reference-theme.css?v=76f993aea3ac","assets/region-sketch.js?v=76f993aea3ac","assets/resident.css?v=76f993aea3ac","assets/scroll-header.js?v=76f993aea3ac","assets/search-theme.css?v=76f993aea3ac","assets/search-theme.js?v=76f993aea3ac","assets/section-navigation.css?v=76f993aea3ac","assets/site-photos.js?v=76f993aea3ac","data/boundary.js?v=76f993aea3ac","data/districts.js?v=76f993aea3ac","data/resources.js?v=76f993aea3ac","data/site-photos.js?v=76f993aea3ac","data/timeline.js?v=76f993aea3ac"];
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
