const VERSION = 'a3e1ddcb9658';
const CACHE = 'toubu-pwa-' + VERSION;
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["about.html?v=a3e1ddcb9658","search.html?v=a3e1ddcb9658","map.html?v=a3e1ddcb9658","install.html","offline.html","manifest.webmanifest","find.html?v=a3e1ddcb9658","calendar.html?v=a3e1ddcb9658","support.html?v=a3e1ddcb9658","support-personal.html?v=a3e1ddcb9658","support-corporate.html?v=a3e1ddcb9658","guide.html?v=a3e1ddcb9658","participate.html?v=a3e1ddcb9658","activities.html?v=a3e1ddcb9658","information.html?v=a3e1ddcb9658","assets/about.css?v=a3e1ddcb9658","assets/app.css?v=a3e1ddcb9658","assets/app.js?v=a3e1ddcb9658","assets/calendar-districts.css?v=a3e1ddcb9658","assets/calendar-schedule.js?v=a3e1ddcb9658","assets/community-app.css?v=a3e1ddcb9658","assets/community-app.js?v=a3e1ddcb9658","assets/community-feed.css?v=a3e1ddcb9658","assets/community-feed.js?v=a3e1ddcb9658","assets/community-preferences.js?v=a3e1ddcb9658","assets/highland-ridge.svg","assets/highland-theme.css?v=a3e1ddcb9658","assets/home.js?v=a3e1ddcb9658","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=a3e1ddcb9658","assets/map.js?v=a3e1ddcb9658","assets/photo-admin.js?v=a3e1ddcb9658","assets/photo-layout.css?v=a3e1ddcb9658","assets/profile-header.js?v=a3e1ddcb9658","assets/pwa.css?v=a3e1ddcb9658","assets/pwa.js?v=a3e1ddcb9658","assets/reading.css?v=a3e1ddcb9658","assets/reading.js?v=a3e1ddcb9658","assets/reference-theme.css?v=a3e1ddcb9658","assets/region-sketch.js?v=a3e1ddcb9658","assets/resident.css?v=a3e1ddcb9658","assets/scroll-header.js?v=a3e1ddcb9658","assets/search-theme.css?v=a3e1ddcb9658","assets/search-theme.js?v=a3e1ddcb9658","assets/section-navigation.css?v=a3e1ddcb9658","assets/site-photos.js?v=a3e1ddcb9658","data/boundary.js?v=a3e1ddcb9658","data/districts.js?v=a3e1ddcb9658","data/resources.js?v=a3e1ddcb9658","data/site-photos.js?v=a3e1ddcb9658","data/timeline.js?v=a3e1ddcb9658"];
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
