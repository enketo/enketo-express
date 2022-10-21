Enketo may be [configured](./tutorial-10-configure.html#offline-enabled) to support offline access to forms. When this configuration is set to `true`, accessing a form in offline-capable mode _while online_ will allow that form to be available for subsequent requests _while offline_.

**Note:** unless specified otherwise, all of the caching and storage discussed below refers to storage _on an individual user's device and browser_. Also unless specified otherwise, caching is not used when the Enketo deployment is not configured to support offline forms, or when the user accesses a form in online-only mode (which is the default).

### Offline-capable mode

#### Service Worker and Cache Storage

The Enketo app registers a [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), which intercepts some network requests in order to [cache](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage) certain resources as they're requested. The following resources are stored in one of two caches:

-   Common static assets used by Enketo to serve and render forms:

    -   The Service Worker script itself
    -   The Enketo app's static assests (core JavaScript and CSS)
    -   CSS supplied by [configured themes](./tutorial-10-configure.html#themes-supported)
    -   The Enketo app icon, which may be displayed if a user bookmarks the app or registers it as a mobile web app
    -   The initial HTML which begins loading the app and the requested form

    This cache is cleared and rebuilt in production, after a brief delay when the user again accesses a form in offline-capable mode _while online_, and when the Enketo service is (re)started with changes to the version specified in `package.json` or the Service Worker script (typically following a new release or during development), or with changes to the configured themes.

-   Resources associated with individual forms:

    -   Media attachments used by the form
    -   [External secondary instances](https://getodk.github.io/xforms-spec/#secondary-instances---external) used by the form

    The resources in this cache will be updated when Enketo detects that they have changed.

For production Enketo deployments, these resources will always be retrieved from the cache if present, without performing additional network requests other than to determine whether they have been updated. To aid maintenance and improvement of Enketo's offline functionality, the requests _are_ performed in development mode.

**Important note:** forms cached prior to release of [these changes to media and HTML caching](https://github.com/enketo/enketo-express/pull/465) must be requested in offline-capable mode while online to be re-added to the cache. Forms cached after that update will no longer have this issue.

#### IndexedDB storage

When loading a form in offline-capable mode for the first time, the following resources are requested and cached in IndexedDB for future access while offline:

-   The form definition itself, [transformed](https://github.com/enketo/enketo-transformer) into a `survey` format which can be consumed by [Enketo Core](https://github.com/enketo/enketo-core)

Once cached, if a user requests this form again in offline-capable mode _while online_, a request is made after a short delay to determine whether the form or its associated resources have changed. If they have changed, the above requests are performed again to update the IndexedDB cache.

If the form and its associated resources **have not** changed, they will always be retrieved from IndexedDB without performing a network request.

#### Submissions and submission attachments

When a user submits a form entry in offline-capable mode, the submission (`record`) and any media files submitted by the user are also added to the IndexedDB cache, acting as a queue of submissions to send when the user is online. After a brief delay, if the user is online at that time, those submissions are sent and removed from the queue. If the user is not online at that time, the app will periodically check online status to determine whether it can process the queue.

#### Draft and auto-saved submissions

As a user fills a form, they may choose to save the submission as a draft, to be completed and submitted at a later time. These are also stored in IndexedDB as `record`s, but they will not be queued for submission until complete. A draft is also automatically saved as the user makes changes to a submission in progress, allowing an incomplete submission to be recovered if the page is reloaded or reopened.

### Caveats

-   Service Workers may not be available in certain environments, such as a browser's private or incognito mode. In those conditions, a user will not be able to access forms offline.

-   As noted above, forms cached prior to the current caching behavior will not be available until they are re-added to the cache.

-   Browsers vary in how long they preserve storage for Service Workers, Cache Storage, and data stored in IndexedDB. They also vary in how much storage is allowed for a given site/app. Users may also manually clear storage. All offline caches should be assumed to be temporary.

### Related caching and use of browser storage in Enketo

There are two cases where Enketo uses, or allows to be used, caching and browser storage in _both_ online-only and offline-capable modes:

-   Forms which reference the [last-saved virtual endpoint](https://getodk.github.io/xforms-spec/#virtual-endpoints) as a secondary instance store the user's most recent submission in IndexedDB in a manner similar to storage of offline submissions and drafts.

-   Resources which would normally be cached by the browser according to their response headers.
