const CACHE_NAME = 'phare-v1';
const ASSETS = [
  './',
  './login.html',
  './phare-gestion-harcelement.html',
  './phare-reunion.html',
  './js/auth.js',
  './js/api.js',
  './js/animations.js',
  './js/ui.js',
  './css/index.css',
  './manifest.json',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Pre-caching static assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event (Cleanup old caches)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Event (Cache-First strategy for static assets)
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests and API calls for offline cache
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
