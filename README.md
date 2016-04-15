Enketo Express [![Build Status](https://travis-ci.org/OpenClinica/enketo-express-oc.svg?branch=master)](https://travis-ci.org/OpenClinica/enketo-express-oc) [![Dependency Status](https://david-dm.org/OpenClinica/enketo-express-oc.svg)](https://david-dm.org/OpenClinica/enketo-express-oc)
==============

_The modern [Enketo Smart Paper](https://enketo.org) web application._

### How to install a test/development server

#### Manually:

1. Install JS prerequisites: [Node.js](https://github.com/nodesource/distributions) (4.x LTS recommended), [Grunt Client](http://gruntjs.com), and [Node-Gyp](https://github.com/TooTallNate/node-gyp)
2. Install [Redis](http://redis.io/topics/quickstart)
3. Install build-essential and git (and libfontconfig to run tests) with `(sudo) apt-get install build-essential git libfontconfig`
4. Clone this repository
5. Install dependencies with `npm install` from the project root
6. Create config/config.json to override values in the [default config](./config/default-config.json). Start with `cp config/default-config.json config/config.json`
7. Build with `grunt` from the project root

#### Using vagrant:

This takes several shortcuts. Do not use for production!

1. Install [Vagrant](http://docs.vagrantup.com/v2/installation/index.html) and [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
2. Run `vagrant up` from project folder and wait until it completes \* 
3. Log in to the VM with `vagrant ssh` and run `cd /vagrant && npm start`

The app should now be running on [localhost:8006](http://localhost:8006). You can test the API in a different console window with:
```curl --user enketorules: -d "server_url=https://ona.io/enketo&form_id=widgets" http://localhost:8006/api/v2/survey```.

_\* sometimes `vagrant up` fails for reasons beyond our control - e.g. if external resources are temporarily unavailable. Try running `vagrant reload --provision` to resolve this._

#### Using Docker:
1. Install [Docker Compose](http://docs.docker.com/compose/install/).
2. Set Enketo Express's API key, the linked form and data server, and any additional desired configurations in the file `setup/docker/envfile.txt`.
3. Run `docker-compose up` from project folder and wait until it completes.

The app should now be running on [localhost:8005](http://localhost:8005).

### How to install a production server

See [this tutorial](http://blog.enketo.org/install-enketo-production-ubuntu/) for detailed instructions.


### How to configure

All configuration is done in config/config.json. Strictly speaking, this file only has to contain the [default properties](./config/default-config.json) that you'd like to override, but it might be safer to include all properties. The configuration items have self-explanatory names and helpful sample values. After editing the configuration, the app will need to be restarted.

The default production configuration includes 2 redis instances. You can **greatly simplify installation by using 1 redis instance** instead (for non-production usage). To do this set the redis.cache.port to 6379 (same as redis.main.port). To set up 2 instances properly for production, you might find the vagrant setup steps in [bootstrap.sh](./setup/bootstrap.sh) useful.

For detailed guidance on each configuration item, see [this document](./config/README.md).

To configure your own custom external authentication also see [this section](#authentication).


### API

The API is accessible on **/api/v2** and **/api/v1**. See [documentation](http://apidocs.enketo.org) on how to use it.


### How to run
Run with `npm start` from project root.

You can now check that the app is running by going to e.g. http://localhost:8005 (depending on your server and port set in config/config.json or the port forwarding set up in Vagrant (default is 8006))

For a production server, we recommend using [pm2](https://github.com/unitech/pm2) or [forever](https://github.com/foreverjs/forever) to manage the node app.


### How to update

* update git repository with `git pull` (check out a specific release (git tag) for a production server)
* update dependencies with `npm update --production`
* re-build with `grunt`
* restart app


### Developer tools
* Install [nodemon](https://github.com/remy/nodemon) to automatically restart the server when a file changes.
* Install [gulp](http://gulpjs.com/) to automatically update the translation keys.
* Install [mocha](https://github.com/mochajs/mocha) to run tests.

The easiest way to start the app in development and debugging mode with livereload is with `grunt develop`.


### Browser support

Only the latest modern browser versions on Windows, OS X, Linux, Android and iOS are officially supported. Chrome or Firefox are the best browsers on all platforms except on iOS. On iOS there are no modern browsers due to Apple's restrictions on third party browsers, but Safari is the least bad option.

Saving as draft and editing of existing records is not supported by Internet Explorer 11. That browser also has some styling degradations that are considered acceptable.

**Enketo endeavors to show a helpful (multi-lingual) error message on unsupported browsers when the form is loaded to avoid serious issues.**


### Differences with [enketo/enketo-legacy](https://github.com/enketo/enketo-legacy)

See [this doc](./doc/differences.md)


### Themes
 
The default theme can be set in config/config.json. The default theme can be overridden in [the form definition](http://xlsform.org/#grid). 

The recommended way to customize themes is to either:

 * Create an issue (and fund or send a pull request) for changes to the existing themes, or
 * Create your own theme in your own enketo-express port and add your custom theme in its own folder [here](app/views/styles). No other changes are required. A succesful rebuild with `grunt`, and your theme will become active when the app starts. The advantage of using this method instead of editing the existing themes, is that you will not have merge conflicts when you update your port! Add a print-specific version of your theme and use the same filenaming convention as the built-in themes.

 See also [this further guidance](https://github.com/enketo/enketo-core#notes-for-css-developers)


### Authentication

This app can manage [OpenRosa form authentication](https://bitbucket.org/javarosa/javarosa/wiki/AuthenticationAPI) for protected forms, i.e. it is possible to log in to forms with credentials set in your OpenRosa Server (e.g. Aggregate/KoBo/Ona), just like in ODK Collect. 

To make use of OpenRosa form authentication, set the following in config/config.json:

* linked form and data server -> authentication -> managed by enketo -> true

Alternatively, you could make use of _external authentication_, i.e. the authentication management of your form and data server. Whenever a request (form, formlist, submission) requires authentication, enketo-express re-directs the user to a login page on the form and data server and simply passes any cookies back to that server whenever it makes any subsequent request. It is up to the form and data server to authenticate based on the cookie content. This mechanism requires any enketo-express webform to have access to these browser cookies so the form/data server and Enketo Express would have to be on the same domain (a different subdomain is possible when setting cross-domain cookies). It also requires the login page to have a mechanism for redirecting the authenticated user back, via a query string parameter.

To make use of external authentication set the following in config/config.json:

* linked form and data server -> authentication -> managed by enketo -> `false`
* linked form and data server -> authentication -> external login url that sets cookie -> e.g. `http://example.com/login?return={RETURNURL}`, where {RETURNURL} will be set by enketo.


### Security

There are two major security considerations to be aware of. Both of these result in the need to run this application on **https** with a valid SSL certificate.

_API security_ is mainly arranged by the secret API key set up in config/config.json. This API key is sent in **cleartext** to Enketo by the form/data server (such as ODK Aggregate) and can easily be intercepted and read _if the transport is not secure_. Somebody could start using your Enketo Express installation for their own form/data server, or obtain the URLs of your forms. Using secure (https) transport mitigates against this hazard. Security increases as well by populating the _server url_ in config/config.json. Also, don't forget to change your API key when you start running Enketo Express in production.

_Form authentication_ is only secure when Enketo is running on **https**. To avoid leaking form server credentials, authentication is automatically disabled when the app is accessed in a 'production' environment on 'http'. If you **have to** to run the app on http in a production environment, you can bypass this security by setting `"allow insecure transport": true` in config/config.json. The only use case this would be acceptable in is when running the app on a local protected network (e.g. in the KoBo VM).


### Translation

The user interface was translated by: Sounay Phothisane (Lao), Linxin Guo (Chinese), Emmanuel Jean, Renaud Gaudin (French), Trần Quý Phi (Vietnamese), Reza Doosti, Hossein Azad, Davood Mottalee (Persian), Tomas Skripcak (Slovak, German), Robert Michael Lundin (Norwegian), Margaret Ndisha, Charles Mutisya (Swahili), Panzero Mauro (Italian), Gabriel Kreindler (Romanian), Jason Reeder, Omar Nazar, Sara Sameer, David Gessel (Arabic), Tino Kreutzer (German), Wasilis Mandratzis-Walz (German, Greek), Luis Molina (Spanish), Martijn van de Rijdt (Dutch).

_Send a message if you'd like to contribute! We use an easy web interface provided by [Transifex](https://www.transifex.com/projects/p/enketo-express/)._


### Funding

The development of this application was funded by [KoBo Toolbox (Harvard Humanitarian Initiative)](http://www.kobotoolbox.org), [iMMAP](http://immap.org), [OpenClinica](https://openclinica.com), and [Enketo LLC](https://enketo.org). The [Enketo-core](https://github.com/enketo/enketo-core) library (the form engine + themes) used in this application obtained significant funding from [SEL (Columbia University)](http://modi.mech.columbia.edu/), the [Santa Fe Institute](http://www.santafe.edu/), [Ona](https://ona.io) and the [HRP project](http://www.who.int/reproductivehealth/topics/mhealth/en/). 

### License

See [the license document](LICENSE) for this application's license.

Note that some of the libraries used in this app have different license. In particular note [this one](https://github.com/enketo/enketo-xpathjs).

The Enketo logo and Icons are trademarked by [Enketo LLC](https://www.linkedin.com/company/enketo-llc). They can be used in the KoBoCAT VM only. Replace the logo images in [/public/images](/public/images) with your own or contact [Enketo LLC](mailto:info@enketo.org) to discuss the use inside your app.

However, note the logo-use exception as part of the 'Powered by Enketo' footer requirement as explained in [enketo-core](https://github.com/enketo/enketo-core#license), which is applicable to all Enketo apps, including this one.

### Change log

See [change log](./CHANGELOG.md)
