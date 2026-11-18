// Service Worker for Institute Night Quiz PWA (Network-First Strategy)
const CACHE_NAME = 'quiz-pwa-v2.1';
const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './style.css',
  './app.js',
  './admin.js',
  './audio.js',
  './supabase.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First: Always fetch freshest files from server/disk, fall back to cache when offline
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => {
      return caches.match(e.request).then((cached) => cached || caches.match('./index.html'));
    })
  );
});
