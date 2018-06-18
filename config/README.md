Configuration
==============

All configuration is done in config/config.json or with equivalent environment variables (see [sample.env](./sample.env)). **Leave config/default-config.json unchanged.** Whichever of these 2 methods you choose, will override the defaults set in config/default-config.json.

Below is a complete list of all configuration items. The **bold items are important to set**. Others are less important.

#### app name 
Just use `"Enketo for [your service name]"`. It is not used much in the app.

#### port
The port on which your app is run, e.g. `"8005"`. Any unique assignable port will do. Generally you can leave this alone as you'll use a reverse proxy to map the public port.

#### offline enabled
Enable or disable offline functionality. Is either `false` or `true`.

#### linked form and data server
* name: The (short) name of your form server. This name will be used in various places in the app to provide feedback to the user. E.g. "ODK Aggregate", "KoboToolbox", "MyCoolService"
* **server url: Initially this can be an empty string (`""`). This will allow any server that knows the secret api key to use your Enketo installation. If you'd like to lock the usage down to a particular form server for optimimum security, fill in your domain without the protocol. E.g. "kobotoolbox.org". Depending on your form server, you can even specify that the server can only be used for a particular account e.g. "myformhub.org/janedoe". You can also use a regular expression string e.g. "opendatakit\\.appspot\\.com" (it will be used to create a regular expression with RegExp()).**
* **api key: The api key that will be used to authenticate any API usage, e.g. to launch a form when the 'webform' button is clicked. This is the key (sometimes called _token_) you need to copy in your form server. You can use any hard-to-guess alphanumeric string you want. We're not aware of limitations in length or characters.**
* legacy formhub: Formhub is a dead project and therefore has bugs that won't be fixed. Setting this setting to `true` temporarily works around some of these bugs to give you time to switch to a better alternative that is alive.
* authentication: an object that configures the type of authentication to use. See examples and details below:

Examples of authentication configuration objects:

##### Basic authentication (default ODK)

This is the default authentication that lets Enketo collect credentials from the user and passes those to the server according to the [ODK request specification](https://bitbucket.org/javarosa/javarosa/wiki/AuthenticationAPI) using either Basic or Digest Authorization headers.

* allow insecure transport: For development use, to test default form authentication on a server without an SSL certificate. Should be `false` on a production server to avoid sharing sensitive user credentials.

```json
"authentication" : {
        "type": "basic",
        "allow insecure transport": "false"
    }
```

##### External cookie authentication

This allows a deeper integration for a custom server. It configures a (required) `url` on your form/data server where Enketo should redirect a user to when the server returns a 401 response. That url should set a cookie that Enketo will pass to the server whenever it needs to retrieve a form resource or submit data. The url should contain a {RETURNURL} portion which Enketo will populate to send the user back to the webform once authentication has completed.

This mechanism requires any enketo-express webform to have access to these browser cookies so the form/data server and Enketo Express would have to be on the same domain (a different subdomain is possible when setting cross-domain cookies).

```json
"authentication" : {
        "type": "cookie",
        "url": "http://example.com/login?return={RETURNURL}"
    }

```

##### External token authentication

This allows a deeper integration for a custom server. It configures a (required) `url` on your form/data server where Enketo should redirect a user to when the server returns a 401 response. It also configures a (required) `query parameter` name that is used to share the token. The token value will be passed _unchanged_ via `Authorization: Bearer` Header to any requests to the server.

**At the moment this only works for online-only forms.**

```json
"authentication" : {
        "type": "token",
        "query parameter": "my_token",
        "url": "http://example.com/login?return={RETURNURL}"
    }
```

#### timeout
Connection timeout in milliseconds used throughout Enketo. This is particularly relevant for submissions from Enketo to the OpenRosa server. 

#### encryption key 
Enketo will use this to encrypt sensitive information whenever necessary (e.g. for the form server credentials that are stored in a cookie in the user's browser). Never share this key and never change it after the initial configuration (unless it was compromised). No specific key length requirements (I think).

#### less secure encryption key 
Enketo will use this to symmetrically encrypt enketo IDs for the special single-submission webform views. This encryption should be considered crackable and is not used for sensitive data. For security reasons it therefore requires a separate key. Do not change this key after initial configuration as it will break some webform URLs.

#### default theme 
The theme to use if the survey has no user-or-api-defined theme. Values could be `"kobo"`, `"formhub"`, `"grid"`, or `"[yourowncustomtheme]"`.

#### base path
The basepath Enketo should use for everything. The default is `""`, which gives a baseUrl like https://yourdomain.com. If you set the value to e.g. `"enketo"`, the baseUrl for the app becomes https://yourdomain.com/enketo. Warning: If the base path is changed, you need to discard your redis **cache** database to ensure form media URLs are re-generated.

#### log
* submissions: Whether successfully submitted _record instanceIDs_ should be logged into log files. This could help troubleshoot any issues with the Form/Data Server or with Enketo. Only 201 responses to /submission on the Form/Data server will be logged. If a record is divided into multiple batches, it should only be recorded once. Logging instancedIDs could be considered a privacy issue, as together with web server logs it will potentially allow one to determine which IP address a specific record (instanceID) was submitted from and when. 

#### themes supported
An array of theme names to enable. This can be used to disable certain themes. If this configuration item is absent or an empty array, all installed themes will be enabled.

#### support
* **email: The email address your users can contact when they experience problems with the service.**

#### widgets
An Array of widgets to enable. Enketo Core widgets are simple strings ("note", "select-desktop", "select-mobile", "autocomplete", "geo", "geo-esri", "textarea", "table", "radio", "date", "time", "datetime", "compact", "file", "draw", "likert", "range", "rank", "url", "horizontal", "image-view", "comment", "image-map", "date-mobile"). See [this file](../public/js/src/module/core-widgets.json) for an update list. You can also add custom widgets by adding a local path. See more info [here](../doc/custom-widgets.md). Note that any value for `"widgets"` will completely override the default array in default-config.json, so it's best to start copying the default array value and amend it as desired or leave it out of config.json if you don't need to modify widgets. If this configuration item is present in config.json, you will need to manually add any new widgets that are added to default-config.json in the future.

#### analytics
Which analytics service you'd like to use, either `"google"` or `"piwik"` or if none is required either `""` or `false`.

#### google
* analytics -> ua: The UA (user agent) that Google has assigned to your domain if you choose to collect statistics on Enketo Express' usage using the Google Analytics service. Required if google service is selected under [analytics](#analytics).
* analytics -> domain: If you are running Enketo Express on a subdomain, you may need to add the subdomain there (without protocol), e.g. "odk.enke.to" for Google Analytics to pick up the data. When left empty (`""`) the value will be set to "auto" in the GA script.
* api key: The Google API key that is used for geolocation (in the geo widgets' search box). Can be obtained [here](https://console.developers.google.com/project). Make sure to enable the _GeoCoding API_ service. If you are using Google Maps layers, the same API key is used. Make sure to enable the _Google Maps JavaScript API v3_ service as well in that case (see next item).

#### piwik
* analytics -> tracker url -> URL on which your piwik service is hosted. The protocol can be omitted, e.g. `"//enketo.piwikpro.com/"`. Required if piwik service is selected under [analytics](#analytics).
* analytics -> site id -> The site ID of this server on your piwik service, e.g. `"1"` (number or string). Required if piwik service is selected under [analytics](#analytics).

#### maps
The `maps` configuration can include an array of Mapbox TileJSON objects (or a subset of these with at least a `name`,  `tiles` (array) and an `attribution` property, and optionally `maxzoom` and `minzoom`). You can also mix and match Google Maps layers. Below is an example of a mix of two map layers provided by OSM (in TileJSON format) and Google maps.

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
For most form servers this item does nothing. If you would like to pass a particular ID to any online-only webform url as a query parameter and track submissions with this ID, you can provide the parameter name here. The parameter and its value will be copied to the submission URL.

#### redis
* main -> host: The IP address of the main redis database instance. If installed on the same server as Enketo Express, the value is `"127.0.0.1"`
* **main -> port: The port of the main redis database instance. This is the important persistent database that contains the unique IDs for each forms. The default value is `"6379"`**
* main -> password: Password of the main redis database instance. Usually `null`.
* cache -> host: The IP address of the cache redis database instance. If installed on the same server as Enketo Express, the value is `"127.0.0.1"`
* **cache -> port: The port of the cache redis database instance. This is the non-persistent database that is just used for caching to greatly improve performance. When testing or developing you could use one redis instance for both 'main' and 'cache' (e.g. both `"6379"`") but do not do this in production.**
* cache -> password: Password of the cache redis database instance. Usually `null`.

#### logo
* source: The logo at the top of each form. Can be a Data URI or just a path to a image file you place in public/images, e.g. `"/images/mylogo.png"`.
* href: The optional link to redirect to if the logo is clicked by the user.

#### disable save as draft
Completely disable save-as-draft functionality in offline-capable webforms by settings this to true.

#### repeat ordinals
Whether to add custom http://enketo.org/xforms namespaced `ordinal` and `last-used-ordinal` attributes to repeat nodes in the model. The default is `false`. Most user will not need to set this configuration item.

#### validate continuously
Determines whether Enketo should validate questions immediately if a related question value changes. E.g. if question A has a constraint that depends on question B, this mode would re-validate question A if the value for question B changes. This mode will slow down form traversal. When set to `false` that type of validation is only done at the end when the Submit button is clicked or in Pages mode when the user clicks Next. The default value is `false`.

#### validate page
Determines whether the Next button should trigger validation and block the user from proceeding to next page if validation fails. The default value is `true`.

#### swipe page
This setting with default `true` value determines whether to enable support for _swiping_ to the next and previous page for forms that are divided into pages.


