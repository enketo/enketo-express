All configuration is done in config/config.json or with equivalent environment variables (see [sample.env](https://github.com/enketo/enketo-express/blob/master/config/sample.env)). **Leave config/default-config.json unchanged.** Whichever of these 2 methods you choose, will override the defaults set in config/default-config.json.

### When to rebuild

Javascript and CSS only needs to be rebuilt when changes to these configuration items are made:

-   [widgets](#widgets)

Changes to any other configuration items only require restarting the app.

### All items

Below is a complete list of all configuration items. The **bold items are important to set**. Others are less important.

#### app name

Just used in home page `"Enketo for [your service name]"`..

#### port

The port on which your app is run, e.g. `"8005"`. Any unique assignable port will do. Generally you can leave this alone as you'll use a reverse proxy to map the public port.

#### max processes

The max number of processes Enketo will serve. Enketo will not serve more processes than the number of cpus available. Defaults to `16`.

#### offline enabled

Enable or disable offline functionality. Is either `false` or `true`.

#### id length

The length of the random enketo ID that is generated for a webform and is part of the webform URL. The default length is 8 characters, the maximum length is 31 characters and the minimum length is 4 characters.

When this value is changed on an active server that had already generated webform URLs before the change, those old URLs will remain functional. Only new form launches will use the new ID length.

If you are tempted to make this setting as short as possible, make sure you understand that the chance of collisions in random ID generation will increase and it may eventually become too slow or impossible to generate a new unique ID.

#### linked form and data server

-   name: The (short) name of your form server. This name will be used in various places in the app to provide feedback to the user. E.g. "ODK Aggregate", "KoboToolbox", "MyCoolService"
-   **server url: Initially this can be an empty string (`""`). This will allow any server that knows the secret api key to use your Enketo installation, and it also provides serious vulnerability to DoS attacks. If you'd like to lock the usage down to a particular form server and reduce vulnerability to DoS, fill in your domain without the protocol. E.g. "kobotoolbox.org". Depending on your form server, you can even specify that the server can only be used for a particular account e.g. "myformhub.org/janedoe". You can also use a regular expression string e.g. `"opendatakit\\.appspot\\.com"` (it will be used to create a regular expression with RegExp()).**
-   **api key: The api key that will be used to authenticate any API usage, e.g. to launch a form when the 'webform' button is clicked. This is the key (sometimes called _token_) you need to copy in your form server. You can use any hard-to-guess alphanumeric string you want. We're not aware of limitations in length or characters.**
-   legacy formhub: Formhub is a dead project and therefore has bugs that won't be fixed. Setting this setting to `true` temporarily works around some of these bugs to give you time to switch to a better alternative that is alive.
-   authentication: an object that configures the type of authentication to use. See examples and details below:

Examples of authentication configuration objects:

##### Basic authentication (default ODK)

This is the default authentication that lets Enketo collect credentials from the user and passes those to the server according to the [ODK request specification](https://bitbucket.org/javarosa/javarosa/wiki/AuthenticationAPI) using either Basic or Digest Authorization headers.

-   allow insecure transport: For development use, to test default form authentication on a server without an SSL certificate. Should be `false` on a production server to avoid sharing sensitive user credentials.

```json
"authentication" : {
        "type": "basic",
        "allow insecure transport": "false"
    }
```

##### External cookie authentication

This allows a deeper integration with a custom server. To use cookie auth, your Enketo configuration must define a `url` on your form/data server where Enketo should redirect a user to when the server returns a 401 response. That url should set a cookie that Enketo will pass to the server whenever it needs to retrieve a form resource or submit data. The url should contain a {RETURNURL} portion which Enketo will populate to send the user back to the webform once authentication has completed.

Cookie authentication is vulnerable to Cross-Site Request Forgery (CSRF) attacks in which a malicious website could trick the user into submitting bad data to the data server by forwarding the same authentication cookie as Enketo does. To protect against this, the data server should set the [`SameSite`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite) attribute as strictly as possible. However, this may not be respected by all browsers and may not be appropriate for all data server implementations because of other cookie-based integrations. For additional protection, if the data server provides a JavaScript-readable `__csrf` cookie field, Enketo will include a `__csrf` form data field on the submission `POST` with the value from the `__csrf` cookie. This allows the data server to verify that the `POST` definitively came from the same origin.

```json
"authentication" : {
        "type": "cookie",
        "url": "http://example.com/login?return={RETURNURL}"
    }

```

##### External token authentication

This allows a deeper integration for a custom server. It configures a (required) `url` on your form/data server where Enketo should redirect a user to when the server returns a 401 response. It also configures a (required) `query parameter` name that is used to share the token. The token value will be passed _unchanged_ via `Authorization: Bearer` Header to any requests to the server.

Please note that using authentication tokens in form URLs may pose a security risk. For example, authentication can be unintentionally shared by copying form URLs. Furthermore, URLs (including query parameters) are commonly logged by (web) servers.

```json
"authentication" : {
        "type": "token",
        "query parameter": "my_token",
        "url": "http://example.com/login?return={RETURNURL}"
    }
```

#### timeout

Connection timeout in milliseconds used throughout Enketo. This is particularly relevant for submissions from Enketo to the OpenRosa server.

#### expiry for record cache

Expiry in milliseconds for a cached record from the moment it is offered to Enketo for editing through one of Enketo's **/instance/\*** API endpoints. Once the expiry time is reached, the record is removed.

#### encryption key

Enketo will use this to encrypt sensitive information whenever necessary (e.g. for the form server credentials that are stored in a cookie in the user's browser). Never share this key and never change it after the initial configuration (unless it was compromised). No specific key length requirements as far as we are aware.

#### less secure encryption key

Enketo will use this to symmetrically encrypt enketo IDs (in URLs) for the special single-submission webform views to avoid easy guessing of the equivalent multi-submission view of the same form. This encryption should be considered crackable and is not used for sensitive data. For security reasons it therefore requires a separate key. Do not change this key after initial configuration as it will break some webform URLs.

#### default theme

The theme to use if the survey has no user-or-api-defined theme. Values could be `"kobo"`, `"formhub"`, `"grid"`, or `"[yourowncustomtheme]"`.

#### base path

The basepath Enketo should use for everything. The default is `""`, which gives a baseUrl like https://yourdomain.com. If you set the value to e.g. `"enketo"`, the baseUrl for the app becomes https://yourdomain.com/enketo. Warning: If the base path is changed, you need to discard your redis **cache** database to ensure form media URLs are re-generated.

#### log

-   submissions: Whether successfully submitted _record instanceIDs_ should be logged into log files. This could help troubleshoot any issues with the Form/Data Server or with Enketo. Only 201 responses to /submission on the Form/Data server will be logged. If a record is divided into multiple batches, it should only be recorded once. Logging instancedIDs could be considered a privacy issue, as together with web server logs it will potentially allow one to determine which IP address a specific record (instanceID) was submitted from and when.

#### themes supported

An array of theme names to enable. This can be used to disable certain themes. If this configuration item is absent or an empty array, all installed themes will be enabled.

#### support

-   **email: The email address your users can contact when they experience problems with the service.**

#### widgets

> ⚠️ Any value for `"widgets"` will completely override the default array in default-config.json, so it's best to start copying the default array value and amend it as desired or leave it out of config.json if you don't need to modify widgets. If this configuration item is present in config.json, **you will need to manually add any new widgets that are added to default-config.json in the future**. ⚠️

An Array of widgets to enable. Enketo Core widgets are simple strings ("note", "select-desktop", "select-mobile", "autocomplete", "geo", "textarea", "table", "radio", "date", "time", "datetime", "compact", "file", "draw", "likert", "range", "rank", "url", "horizontal", "image-view", "comment", "image-map", "date-mobile"). See [this file](https://github.com/enketo/enketo-express/blob/master/public/js/src/module/core-widgets.json) for an up-to-date list. You can also add custom widgets by adding a local path. More info: {@tutorial 34-custom-widgets}.

> ⚠️ You must rebuild for changes to `"widgets"` to take effect. ⚠️

#### analytics

Which analytics service you'd like to use, either `"google"` or `"piwik"` or if none is required either `""` or `false`.

#### google

-   analytics -> ua: The UA (user agent) that Google has assigned to your domain if you choose to collect statistics on Enketo Express' usage using the Google Analytics service. Required if google service is selected under [analytics](#analytics).
-   analytics -> domain: If you are running Enketo Express on a subdomain, you may need to add the subdomain there (without protocol), e.g. "odk.enke.to" for Google Analytics to pick up the data. When left empty (`""`) the value will be set to "auto" in the GA script.
-   api key: The Google API key that is used for geocoding (i.e. the search box in the geo widgets). Can be obtained [here](https://console.developers.google.com/project). Make sure to enable the _GeoCoding API_ service. If you are using Google Maps layers, the same API key is used. Make sure to enable the _Google Maps JavaScript API v3_ service as well in that case (see next item).

#### piwik

-   analytics -> tracker url -> URL on which your piwik service is hosted. The protocol can be omitted, e.g. `"//enketo.piwikpro.com/"`. Required if piwik service is selected under [analytics](#analytics).
-   analytics -> site id -> The site ID of this server on your piwik service, e.g. `"1"` (number or string). Required if piwik service is selected under [analytics](#analytics).

#### headless

-   timeout: Connection timeout in milliseconds used in headless views that are run on the server, such as for PDF generation API endpoints.

#### maps

The `maps` configuration can include an array of Mapbox TileJSON objects (or a subset of these with at least a `name`, `tiles` (array) and an `attribution` property, and optionally `maxzoom` and `minzoom`). You can also mix and match Google Maps layers. Below is an example of a mix of two map layers provided by OSM (in TileJSON format) and Google maps.

```
[ {
        "name": "street",
        "tiles": [ "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" ],
        "attribution": "Map data © <a href=\"http://openstreetmap.org\">OpenStreetMap</a> contributors"
    }, {
        "name": "satellite",
        "tiles": "GOOGLE_SATELLITE"
} ]
```

For GMaps layers you have the four options as tiles values: `"GOOGLE_SATELLITE"`, `"GOOGLE_ROADMAP"`, `"GOOGLE_HYBRID"`, `"GOOGLE_TERRAIN"`. You can also add other TileJSON properties, such as minZoom, maxZoom, id to all layers.

#### query parameter to pass to submission

Specifies the name of a query parameter that will be copied from an Enketo URL to the submission and formList requests. The value of this parameter can be used by the data server to e.g. track submission sources, perform form access control, or serve custom external data per user.

#### redis

-   main -> host: The IP address of the main redis database instance. If installed on the same server as Enketo Express, the value is `"127.0.0.1"`
-   **main -> port: The port of the main redis database instance. This is the important persistent database that contains the unique IDs for each forms. The default value is `"6379"`**
-   main -> password: Password of the main redis database instance. Usually `null`.
-   cache -> host: The IP address of the cache redis database instance. If installed on the same server as Enketo Express, the value is `"127.0.0.1"`
-   **cache -> port: The port of the cache redis database instance. This is the non-persistent database that is just used for caching to greatly improve performance. When testing or developing you could use one redis instance for both 'main' and 'cache' (e.g. both `"6379"`") but do not do this in production.**
-   cache -> password: Password of the cache redis database instance. Usually `null`.

#### logo

-   source: The logo at the top of each form. Can be a Data URI or just a path to a image file you place in public/images, e.g. `"/images/mylogo.png"`.
-   href: The optional link to redirect to if the logo is clicked by the user.

#### disable save as draft

Completely disable save-as-draft functionality in offline-capable webforms by setting this to `true`.

#### repeat ordinals

Whether to add custom http://enketo.org/xforms namespaced `ordinal` and `last-used-ordinal` attributes to repeat nodes in the model. The default is `false`. Most users will not need to set this configuration item.

#### validate continuously

Determines whether Enketo should validate questions immediately if a related question value changes. E.g. if question A has a constraint that depends on question B, this mode would re-validate question A if the value for question B changes. This mode will slow down form traversal. When set to `false` that type of validation is only done at the end when the Submit button is clicked or in Pages mode when the user clicks Next. The default value is `false`.

#### validate page

Determines whether the Next button should trigger validation and block the user from proceeding to next page if validation fails. The default value is `true`.

#### swipe page

This setting with default `true` value determines whether to enable support for _swiping_ to the next and previous page for forms that are divided into pages.

#### payload limit

This setting sets the maximum weight of payload sent to Enketo's API. Unit can be `b`, `kb` or `mb`.
The default value is `100kb`.

#### text field character limit

Sets the maximum allowable text field characters with a default of 2000. This settings is meant to match any back-end database limits to avoid a situation where records cannot be submitted because the server does not accept them.

#### ip filtering

Sets which IPs should be filtered out to prevent SSRF attacks. See more here: https://www.npmjs.com/package/request-filtering-agent

-   `allowPrivateIPAddress`: Default is `false`. Prevents or allows private IP addresses to make GET and HEAD requests.
-   `allowMetaIPAddress`: Default is `false`. Prevents or allows meta IP addresses to make GET and HEAD requests.
-   `allowIPAddressList`: Default is `[]`. The list of allowed IP addresses. These are preferred over `denyAddressList`.
-   `denyAddressList`: Default is `[]`. The list of denied IP addresses.

### frameguard deny

Set to `true` to set the X-Frame-Options header to DENY to help you mitigate clickjacking attacks. Default is `false`. See more here: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options

### no sniff

Set to `true` to set the X-Content-Type-Options header to nosniff. This mitigates MIME type sniffing which can cause security vulnerabilities. Default is `false`. See more here: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options

#### hsts

Set HTTP Strict Transport Security (HSTS) headers in express. Default is disabled. See more here: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security

-   `seconds`: Default is `0`. Seconds for HSTS to be enabled. When set to 0, header will not be set and HSTS is disabled. Set to a low number to test. For production, set to 63072000 (2 years).
-   `preload`: Default is `false`. Submit to HSTS preload service.
-   `includeSubDomains`: Default is `false`. When set, all subdomains will be subject to same HSTS rules.

#### csp

Set Content Security Policy (CSP) headers in express. Default is disabled. When enabled, a default policy is applied unless the `value` field is provided. See more here: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP

-   `enabled`: Default is `false`. Set to `true` to enable CSP headers.
-   `report only`: Default is `false`. Set to `true` to report, but not enforce, CSP.
-   `value`: Default is `null`. Set to a custom value to override default CSP value.

#### csrf cookie name

Default is "\_\_csrf". Set to override the cookie name used for a csrf token. This can be helpful to avoid conflicts with other cookies on a domain.

#### exclude non-relevant

Default is `false`. When set to `true`, questions with non-relevant values and children of non-relevant parents will be treated as blank in computations. If a non-relevant question becomes relevant again, its previous value will be restored. This matches the behavior of ODK Collect.
