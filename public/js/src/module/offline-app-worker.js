const CACHE_KEY = 'enketo-common';

/**
 * @param {RequestInfo} request
 */
const tryFetch = async (request) => {
    try {
        return await fetch(request, {
            credentials: 'same-origin',
            cache: 'reload',
        });
    } catch (error) {
        return new Response(JSON.stringify({ message: error.message }), {
            status: 500,
            statusText: 'Internal Server Error',
            headers: {
                'content-type': 'application/json',
            },
        });
    }
};

/**
 * @param {Request} request
 * @param {Response} response
 */
const cacheResponse = (request, response) => {
    caches.open(CACHE_KEY).then((cache) => {
        cache.put(request, response);
    });
};

/** @type {string[]} */
const prefetchURLs = [];

/**
 * @param {Response} response
 */
const setPrefetchURLs = (response) => {
    const linkHeader = response.headers.get('link');

    if (linkHeader == null) {
        return;
    }

    const prefetchLinks = linkHeader.matchAll(/<([^>]+)>;\s*rel="prefetch"/g);

    for (const match of prefetchLinks) {
        prefetchURLs.push(match[1]);
    }
};

const cachePrefetchURLs = () =>
    Promise.all(
        prefetchURLs.map(async (url) => {
            const request = new Request(url);
            const response = await tryFetch(request);

            cacheResponse(request, response.clone());
        })
    );

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(cachePrefetchURLs());
});

const removeStaleCaches = async () => {
    const keys = await caches.keys();

    await Promise.all(
        keys.map((key) => {
            if (key !== CACHE_KEY) {
                caches.delete(key);
            }
        })
    );
};

const onActivate = async () => {
    await self.clients.claim();
    await removeStaleCaches();
};

self.addEventListener('activate', (event) => {
    event.waitUntil(onActivate());
});

/**
 * @param {Request} request
 */
const onFetch = async (request) => {
    const { url } = request;
    const isServiceWorkerScript = url === self.location.href;
    const isPageRequest = url === request.referrer;
    const cacheKey = isPageRequest
        ? new URL('/x/', self.location.href)
        : request;

    const [{ value: response }, { value: cached }] = await Promise.allSettled([
        tryFetch(request),
        caches.match(cacheKey),
    ]);

    if (
        cached != null &&
        (response == null ||
            response.status !== 200 ||
            response.type !== 'basic')
    ) {
        return cached;
    }

    if (
        request.method !== 'GET' ||
        response == null ||
        response.status !== 200
    ) {
        return response;
    }

    cacheResponse(cacheKey, response.clone());

    if (isServiceWorkerScript) {
        setPrefetchURLs(response.clone());
    }

    return response;
};

self.addEventListener('fetch', (event) => {
    event.respondWith(onFetch(event.request));
});
