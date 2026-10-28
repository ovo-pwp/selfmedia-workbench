/* Service Worker：静态资源缓存优先，数据接口网络优先并兜底缓存 */
const VER = 'v6';
const STATIC_CACHE = 'zm-static-' + VER;
const DATA_CACHE = 'zm-data-' + VER;

const STATIC_FILES = [
  './',
  './index.html',
  './assets/css/style.css',
  './assets/js/store.js',
  './assets/js/generator.js',
  './assets/js/sensitive.js',
  './assets/js/views.js',
  './assets/js/app.js',
  './manifest.json?sharecode=KLEYZT3KBE',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((c) => Promise.all(
        // 逐个缓存：某一个失败（比如被网关拦）不会拖垮整批
        STATIC_FILES.map((f) => c.add(f).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.endsWith(VER)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 数据：先网络（保证最新），失败用缓存 → 页面永远不会空白
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/daily.json') || url.pathname.endsWith('/hot.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(DATA_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || new Response('{}', { headers: { 'Content-Type': 'application/json' } })))
    );
    return;
  }

  // 静态：缓存优先
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) {
        fetch(req).then((res) => {
          if (res.ok) caches.open(STATIC_CACHE).then((c) => c.put(req, res)).catch(() => {});
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
