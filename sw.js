const VERSION = 'fb4dc180f806';
const CACHE = 'toubu-pwa-' + VERSION;
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["about.html?v=fb4dc180f806","search.html?v=fb4dc180f806","map.html?v=fb4dc180f806","install.html","offline.html","manifest.webmanifest","find.html?v=fb4dc180f806","calendar.html?v=fb4dc180f806","support.html?v=fb4dc180f806","support-personal.html?v=fb4dc180f806","support-corporate.html?v=fb4dc180f806","guide.html?v=fb4dc180f806","participate.html?v=fb4dc180f806","activities.html?v=fb4dc180f806","information.html?v=fb4dc180f806","assets/about.css?v=fb4dc180f806","assets/app.css?v=fb4dc180f806","assets/app.js?v=fb4dc180f806","assets/calendar-districts.css?v=fb4dc180f806","assets/calendar-schedule.js?v=fb4dc180f806","assets/community-app.css?v=fb4dc180f806","assets/community-app.js?v=fb4dc180f806","assets/community-feed.css?v=fb4dc180f806","assets/community-feed.js?v=fb4dc180f806","assets/community-preferences.js?v=fb4dc180f806","assets/highland-ridge.svg","assets/highland-theme.css?v=fb4dc180f806","assets/home.js?v=fb4dc180f806","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=fb4dc180f806","assets/map.js?v=fb4dc180f806","assets/photo-admin.js?v=fb4dc180f806","assets/photo-layout.css?v=fb4dc180f806","assets/profile-header.js?v=fb4dc180f806","assets/pwa.css?v=fb4dc180f806","assets/pwa.js?v=fb4dc180f806","assets/reading.css?v=fb4dc180f806","assets/reading.js?v=fb4dc180f806","assets/reference-theme.css?v=fb4dc180f806","assets/region-sketch.js?v=fb4dc180f806","assets/resident.css?v=fb4dc180f806","assets/search-theme.css?v=fb4dc180f806","assets/search-theme.js?v=fb4dc180f806","assets/section-navigation.css?v=fb4dc180f806","assets/site-photos.js?v=fb4dc180f806","data/boundary.js?v=fb4dc180f806","data/districts.js?v=fb4dc180f806","data/resources.js?v=fb4dc180f806","data/site-photos.js?v=fb4dc180f806","data/timeline.js?v=fb4dc180f806"];
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
