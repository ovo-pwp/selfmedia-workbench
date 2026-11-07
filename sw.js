/* Service Worker：静态资源缓存优先，数据接口网络优先并兜底缓存 */
const VER = 'v17';
const STATIC_CACHE = 'zm-static-' + VER;
const DATA_CACHE = 'zm-data-' + VER;

const STATIC_FILES = [
  './',
  './index.html',
  './assets/css/style.css',
  './assets/js/store.js',
  './assets/js/generator.js',
  './assets/js/sensitive.js',
  './assets/js/tarot.js',
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

  // 数据接口：先网络，失败用缓存 → 页面永远不会空白
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

  // 其余（HTML / JS / CSS / 图标）：网络优先。
  // 之前是缓存优先，导致改了代码用户要刷新两次才看得到，体验很差。
  // 断开网络时自动回退到缓存，离线依然可用。
  // 缓存 key 去掉 ?v= 查询串：版本号只用来穿透 HTTP 缓存，不该污染 SW 缓存。
  const key = url.origin + url.pathname;
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(STATIC_CACHE).then((c) => c.put(key, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(key).then((hit) => hit || caches.match('./index.html') || caches.match('./'))
    )
  );
});
