const VERSION = 'cb5083970522';
const CACHE = 'toubu-pwa-' + VERSION;
const DEVELOPMENT = ['localhost','127.0.0.1','[::1]'].includes(self.location.hostname);
const PRECACHE = ["about.html?v=cb5083970522","search.html?v=cb5083970522","map.html?v=cb5083970522","install.html","offline.html","manifest.webmanifest","find.html?v=cb5083970522","calendar.html?v=cb5083970522","support.html?v=cb5083970522","support-personal.html?v=cb5083970522","support-corporate.html?v=cb5083970522","guide.html?v=cb5083970522","participate.html?v=cb5083970522","activities.html?v=cb5083970522","information.html?v=cb5083970522","assets/about.css?v=cb5083970522","assets/app.css?v=cb5083970522","assets/app.js?v=cb5083970522","assets/calendar-districts.css?v=cb5083970522","assets/calendar-schedule.js?v=cb5083970522","assets/community-app.css?v=cb5083970522","assets/community-app.js?v=cb5083970522","assets/community-feed.css?v=cb5083970522","assets/community-feed.js?v=cb5083970522","assets/community-preferences.js?v=cb5083970522","assets/home.js?v=cb5083970522","assets/icons/app-192.png","assets/icons/app-512.png","assets/icons/app-maskable.png","assets/map-app.js?v=cb5083970522","assets/map.js?v=cb5083970522","assets/photo-admin.js?v=cb5083970522","assets/photo-layout.css?v=cb5083970522","assets/pwa.css?v=cb5083970522","assets/pwa.js?v=cb5083970522","assets/reading.css?v=cb5083970522","assets/reading.js?v=cb5083970522","assets/reference-theme.css?v=cb5083970522","assets/region-sketch.js?v=cb5083970522","assets/resident.css?v=cb5083970522","assets/search-theme.css?v=cb5083970522","assets/search-theme.js?v=cb5083970522","assets/section-navigation.css?v=cb5083970522","assets/site-photos.js?v=cb5083970522","data/boundary.js?v=cb5083970522","data/districts.js?v=cb5083970522","data/resources.js?v=cb5083970522","data/site-photos.js?v=cb5083970522","data/timeline.js?v=cb5083970522"];
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
