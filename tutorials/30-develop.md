### Installing a development server.

See [Getting Started](./tutorial-00-getting-started.html).

### Running in development mode

The easiest way to start the app in development and debugging mode with livereload is with `grunt develop`.

### Launch a test form

Enketo Express needs an OpenRosa-compliant server to obtain forms and submit data too. For development you can conveniently use any public or local server for this with the {@tutorial 32-api}.
For example to use your https://kobotoolbox.org or https://ona.io account "ali", the _server\_url_ to use in API calls is `"https://kc.kobotoolbox.org/ali"` or `"https://ona.io/ali"`.

An API call to get the Enketo webform url for a form called "TestForm" can thus be made like this:

```bash
curl --user enketorules: -d "server_url=https://kc.kobotoolbox.org/ali&form_id=TestForm" http://localhost:8005/api/v2/survey

```

Once you have the Enketo webform URL can start development on a feature or bug. 

Another convenient way for some subset of development work is to put your XForm on any webserver (local, public), and use a preview url with a query parameter, e.g.:

`http://localhost:8005/preview?http://example.org/myform.xml` (officially, the query parameter should be URL encoded, though for development use this is often fine).

#### Release a new version

Documentation is auto-generated and should be re-built for each new release. Do not commit updated documentation in non-release commits. The process to follow for each release that includes various helpful checks is:

1. Change some code.
2. Build documentation: `npm run build-docs`.
3. Bump the version tag in `package.json` file (we follow [semantic versioning](https://semver.org/)).
4. Merge all your changes to `master` (through PR).
5. Add git tag of new version.
