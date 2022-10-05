const CACHES = [`enketo-common`];

self.addEventListener('install', () => {
    self.skipWaiting();
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

    if (response == null || response.status !== 200) {
        return response;
    }

    // Cache any additional loaded languages
    const responseToCache = response.clone();

    // Cache any non-English language files that are requested
    // Also, if the cache didn't get built correctly using the explicit resources list,
    // just cache whatever is scoped dynamically to self-heal the cache.
    caches.open(CACHES[0]).then((cache) => {
        cache.put(request, responseToCache);
    });

    return response;
};

self.addEventListener('fetch', (event) => {
    event.respondWith(onFetch(event.request));
});
