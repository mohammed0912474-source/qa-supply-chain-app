/* Service worker — QA Supply Chain
   إصلاح: كانت المسارات تشير إلى مجلد assets/ غير موجود، فكان cache.addAll يفشل بالكامل
   (فشل عنصر واحد يُسقط العملية كلها) والتطبيق لا يعمل دون اتصال إطلاقاً.
   الآن المسارات صحيحة من الجذر، والتخزين المبدئي مُحصَّن ضد فشل أي ملف مفرد. */
const CACHE_NAME = 'qa-supply-chain-shell-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './app-part1.js',
  './app-part2.js',
  './app-icon-professional.png',
  './icon-192.png',
  './icon-512.png',
  './login-bg-optimized.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(
        // كل ملف على حدة: فشل واحد لا يُسقط بقية التخزين
        SHELL.map(url => cache.add(url).catch(err => {
          console.warn('[sw] skipped precache:', url, err && err.message);
        }))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  // التنقل: الشبكة أولاً حتى يحصل المستخدم على أحدث نسخة، مع رجوع للنسخة المخزنة دون اتصال
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // بقية الأصول: المخزن أولاً ثم الشبكة
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // لا نخزّن الردود الفاشلة أو الجزئية
        if (!response || !response.ok || response.type === 'opaque') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
