const VERSION = 'flyer-flow-20261030';
const CACHE = 'toubu-pwa-flyer-flow-20261030';
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["assets/flyer-experience.css?v=flyer-flow-20261030","assets/flyer-samples/shakyo-sample.png","assets/flyer-samples/houkatsu-sample-v2.png","data/flyers.js?v=flyer-flow-20261030","assets/flyers.js?v=flyer-flow-20261030","about.html?v=flyer-flow-20261030","search.html?v=flyer-flow-20261030","map.html?v=flyer-flow-20261030","install.html","offline.html","manifest.webmanifest","find.html?v=flyer-flow-20261030","calendar.html?v=flyer-flow-20261030","support.html?v=flyer-flow-20261030","support-personal.html?v=flyer-flow-20261030","support-corporate.html?v=flyer-flow-20261030","guide.html?v=flyer-flow-20261030","participate.html?v=flyer-flow-20261030","activities.html?v=flyer-flow-20261030","information.html?v=flyer-flow-20261030","assets/about.css?v=flyer-flow-20261030","assets/app.css?v=flyer-flow-20261030","assets/app.js?v=flyer-flow-20261030","assets/calendar-districts.css?v=flyer-flow-20261030","assets/calendar-schedule.js?v=flyer-flow-20261030","assets/community-app.css?v=flyer-flow-20261030","assets/community-app.js?v=flyer-flow-20261030","assets/community-feed.css?v=flyer-flow-20261030","assets/community-feed.js?v=flyer-flow-20261030","assets/community-preferences.js?v=flyer-flow-20261030","assets/highland-ridge.svg","assets/highland-theme.css?v=flyer-flow-20261030","assets/home.js?v=flyer-flow-20261030","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=flyer-flow-20261030","assets/map.js?v=flyer-flow-20261030","assets/photo-admin.js?v=flyer-flow-20261030","assets/photo-layout.css?v=flyer-flow-20261030","assets/profile-header.js?v=flyer-flow-20261030","assets/pwa.css?v=flyer-flow-20261030","assets/pwa.js?v=flyer-flow-20261030","assets/reading.css?v=flyer-flow-20261030","assets/reading.js?v=flyer-flow-20261030","assets/reference-theme.css?v=flyer-flow-20261030","assets/region-sketch.js?v=flyer-flow-20261030","assets/resident.css?v=flyer-flow-20261030","assets/scroll-header.js?v=flyer-flow-20261030","assets/search-theme.css?v=flyer-flow-20261030","assets/search-theme.js?v=flyer-flow-20261030","assets/section-navigation.css?v=flyer-flow-20261030","assets/site-photos.js?v=flyer-flow-20261030","data/boundary.js?v=flyer-flow-20261030","data/districts.js?v=flyer-flow-20261030","data/resources.js?v=flyer-flow-20261030","data/site-photos.js?v=flyer-flow-20261030","data/timeline.js?v=flyer-flow-20261030"];
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
