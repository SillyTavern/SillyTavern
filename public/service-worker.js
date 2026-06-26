const CACHE_NAME = 'sillytavern-shell-v1';
const SHELL_ASSETS = [
    '/',
    '/login.html',
    '/manifest.json',
    '/style.css',
    '/css/st-tailwind.css',
    '/css/mobile-styles.css',
    '/css/login.css',
    '/favicon.ico',
    '/img/apple-icon-192x192.png',
    '/img/apple-icon-512x512.png',
    '/scripts/pwa.js',
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS)));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)),
    )));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') {
        return;
    }

    const url = new URL(request.url);
    if (url.origin !== location.origin || url.pathname.startsWith('/api/')) {
        return;
    }

    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
