### Developer tools

* Install [nodemon](https://github.com/remy/nodemon) to automatically restart the server when a file changes.
* Install [gulp](http://gulpjs.com/) to automatically update the translation keys.
* Install [mocha](https://github.com/mochajs/mocha) to run tests.

The easiest way to start the app in development and debugging mode with livereload is with `grunt develop`.

#### Release a new version

Documentation is auto-generated and is re-built for each new release. Do not commit updated documentation in non-release commits. The process to follow for each release that includes various helpful checks is:

1. Change some code.
2. Build documentation: `npm run build-docs`.
3. Bump the version tag in `package.json` file (we follow [semantic versioning](https://semver.org/)).
4. Merge all your changes to `master` (through PR).
5. Add git tag of new version.
6. Publish module to NPM: `npm run publish-please`

 We use [publish-please](https://github.com/inikulin/publish-please) - a tool that does various checks before publishing to NPM repository. It runs the test suite, beautifies the code, builds documentation (to check if there are any unbuilt changes), checks for any uncommitted changes and more. It basically verifies that you didn't miss any of the required steps. If you want to test it without publishing, use a flag: `npx publish-please --dry-run`.
