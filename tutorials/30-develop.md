### Installing a development server.

See [Getting Started](./tutorial-00-getting-started.html).

### Running in development mode

The easiest way to start the app in development and debugging mode with livereload is with `grunt develop`.

### Testing

-   Testing is done with Mocha and Karma.
    -   all: `npm run test`
    -   headless: `npm run test-headless`
    -   browsers: `npm run test-browsers`
-   Tests can be run in watch mode for [TDD](https://en.wikipedia.org/wiki/Test-driven_development) workflows with.

    -   client: `npm run test-watch-client`
    -   server: `npm run test-watch-server`

    Support for debugging in [VSCode](https://code.visualstudio.com/) is provided. For instructions see [./#debugging-test-watch-mode-in-vscode](Debugging test watch mode in VSCode) below.

#### Debugging test watch mode in VSCode

Basic usage:

1. Go to VSCode's "Run and Debug" panel
2. Select "Test client (watch + debug)" or "Test server (watch + debug)"
3. Click the play button

Optionally, you can add a keyboard shortcut to select launch tasks:

1. Open the keyboard shortcuts settings (cmd+k cmd+s on Mac, ctrl+k ctrl+s on other OSes)
2. Search for `workbench.action.debug.selectandstart`
3. Click the + button to add your preferred keybinding keybinding

### Launch a test form

Enketo Express needs an OpenRosa-compliant server to obtain forms and submit data too. For development you can conveniently use any public or local server for this with the {@tutorial 32-api}.
For example to use your https://kobotoolbox.org or https://ona.io account "ali", the _server_url_ to use in API calls is `"https://kc.kobotoolbox.org/ali"` or `"https://ona.io/ali"`.

An API call to get the Enketo webform url for a form called "TestForm" can thus be made like this:

```bash
curl --user enketorules: -d "server_url=https://kc.kobotoolbox.org/ali&form_id=TestForm" http://localhost:8005/api/v2/survey

```

Once you have the Enketo webform URL can start development on a feature or bug.

Another convenient way for some subset of development work is to put your XForm on any webserver (local, public), and use a preview url with a query parameter, e.g.:

`http://localhost:8005/preview?xform=http://example.org/myform.xml` (officially, the query parameter should be URL encoded, though for development use this is often fine).

#### Release a new version

Documentation is auto-generated and should be re-built for each new release. Do not commit updated documentation in non-release commits. The process to follow for each release that includes various helpful checks is:

1. Check [Dependabot alerts](https://github.com/enketo/enketo-express/security/dependabot) for vulnerabilities
2. Update dependencies: `npm update`
3. `npm audit fix`
4. Make sure tests pass: `npm run test`
5. Beautiful code: `npm run beautify`
6. Build documentation: `npm run build-docs`
7. Bump the version tag in `package.json` file (we follow [semantic versioning](https://semver.org/))
8. Update `CHANGELOG.md` with changes
9. Merge all your changes to `master` (through PR)
10. Add git tag of new version
