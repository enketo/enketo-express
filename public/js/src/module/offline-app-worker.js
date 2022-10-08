const CACHE_KEY = 'enketo-common';

self.addEventListener('install', () => {
    self.skipWaiting();
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
 * @param {RequestInfo} request
 * @param {RequestInit} options
 */
const tryFetch = async (request, options) => {
    try {
        return await fetch(request, options);
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
 */
const onFetch = async (request) => {
    const [{ value: response }, { value: cached }] = await Promise.allSettled([
        tryFetch(request, {
            credentials: 'same-origin',
            cache: 'reload',
        }),
        caches.match(request),
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

    const responseToCache = response.clone();

    caches.open(CACHE_KEY).then((cache) => {
        cache.put(request, responseToCache);
    });

    return response;
};

self.addEventListener('fetch', (event) => {
    event.respondWith(onFetch(event.request));
});
