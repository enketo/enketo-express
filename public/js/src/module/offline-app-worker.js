const STATIC_CACHE = 'enketo-common';
const FORMS_CACHE = 'enketo-forms';

/**
 * @param {string} url
 */
const cacheName = (url) => {
    if (
        url === '/favicon.ico' ||
        url.endsWith('/x/') ||
        /\/x\/((css|fonts|images|js|locales)\/|offline-app-worker.js)/.test(url)
    ) {
        return STATIC_CACHE;
    }

    return FORMS_CACHE;
};

/**
 * @param {Request | string} key
 * @param {Response} response
 */
const cacheResponse = async (key, response) => {
    const clone = response.clone();
    const cache = await caches.open(cacheName(key.url ?? key));

    await cache.put(key, clone);

    return response;
};

/**
 * @param {Response} response
 */
const cachePrefetchURLs = async (response) => {
    const linkHeader = response.headers.get('link') ?? '';
    const prefetchURLs = [
        ...linkHeader.matchAll(/<([^>]+)>;\s*rel="prefetch"/g),
    ].map(([, url]) => url);

    const cache = await caches.open(STATIC_CACHE);

    await Promise.allSettled(prefetchURLs.map((url) => cache.add(url)));
};

self.addEventListener('install', () => {
    self.skipWaiting();
});

const removeStaleCaches = async () => {
    const cacheStorageKeys = await caches.keys();

    cacheStorageKeys.forEach((key) => {
        if (key !== FORMS_CACHE) {
            caches.delete(key);
        }
    });
};

const onActivate = async () => {
    await self.clients.claim();
    await removeStaleCaches();
};

self.addEventListener('activate', (event) => {
    event.waitUntil(onActivate());
});

const FETCH_OPTIONS = {
    cache: 'reload',
    credentials: 'same-origin',
};

/**
 * @param {Request} request
 */
const onFetch = async (request) => {
    const { method, referrer, url } = request;

    if (method !== 'GET') {
        return fetch(request, FETCH_OPTIONS);
    }

    const isFormPageRequest =
        url.includes('/x/') && (referrer === '' || referrer === url);
    const cacheKey = isFormPageRequest ? url.replace(/\/x\/.*/, '/x/') : url;
    const cached = await caches.match(cacheKey);

    let response = cached;

    if (response == null || ENV === 'development') {
        try {
            response = await fetch(request, FETCH_OPTIONS);
        } catch {
            // Probably offline
        }
    }

    if (
        response == null ||
        response.status !== 200 ||
        response.type !== 'basic'
    ) {
        return response;
    }

    if (isFormPageRequest) {
        const { status } = response.clone();

        if (status === 204) {
            return caches.match(cacheKey);
        }

        await cacheResponse(url, new Response(null, { status: 204 }));
    }

    const isServiceWorkerScript = url === self.location.href;

    if (isServiceWorkerScript) {
        cachePrefetchURLs(response);
    }

    await cacheResponse(cacheKey, response.clone());

    return response;
};

const { origin } = self.location;

self.addEventListener('fetch', (event) => {
    const { request } = event;
    const requestURL = new URL(request.url);

    if (requestURL.origin === origin) {
        event.respondWith(onFetch(request));
    }
});
