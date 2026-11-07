// VERSION and FILES are generated from the production build.
const scope = new URL(self.registration.scope);
const prefix = 'eli-tracker-shell:' + scope.href + ':';
const cacheName = prefix + VERSION;
const assets = new Set(FILES.map((file) => new URL(file, scope).href));
const index = new URL('index.html', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(prefix) && key !== cacheName).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;
  const isAppPage = request.mode === 'navigate' &&
    (url.pathname === scope.pathname || url.pathname === new URL(index).pathname);
  if (!isAppPage && !assets.has(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    // Public build assets are identical across request headers.
    return (await cache.match(isAppPage ? index : url.href, { ignoreVary: true })) || fetch(request);
  })());
});
