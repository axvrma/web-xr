const CACHE_NAME = 'voxr-studio-v1';
const APP_SHELL = [
    '/',
    '/manifest.webmanifest',
    '/icons/icon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request);
        cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        return cached || cache.match('/');
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
    }
    return response;
}
