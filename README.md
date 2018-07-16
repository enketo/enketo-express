Enketo Express [![Build Status](https://travis-ci.org/kobotoolbox/enketo-express.svg?branch=master)](https://travis-ci.org/kobotoolbox/enketo-express) [![Dependency Status](https://david-dm.org/kobotoolbox/enketo-express.svg)](https://david-dm.org/kobotoolbox/enketo-express) [![Codacy Badge](https://api.codacy.com/project/badge/Grade/609aaf6fa764454f901f1c8a427264ff)](https://www.codacy.com/app/martijnr/enketo-express?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=enketo/enketo-express&amp;utm_campaign=Badge_Grade)
==============

_The modern [Enketo Smart Paper](https://enketo.org) web application._

### How to install a test/development server

#### Manually:

1. Install JS prerequisites: [Node.js](https://github.com/nodesource/distributions) (8.x LTS recommended), [Grunt Client](http://gruntjs.com), and [Node-Gyp](https://github.com/TooTallNate/node-gyp)
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
2. Create a [config file](./config/) at `config/config.json` specifying at minimum an API key.
3. **(Optional)** For HTTPS, copy your SSL certificate and key files to `setup/docker/secrets/ssl.crt` and `setup/docker/secrets/ssl.key` respectively (take care not to commit these files back to any public git repository). Plain HTTP requests to Enketo Express will be automatically redirected to HTTPS.
4. Execute `docker-compose up -d` from the [`setup/docker`](./setup/docker) directory and wait to see e.g. `Worker 1 ready for duty...`.
5. To stop, execute `docker-compose stop` from the [`setup/docker`](./setup/docker) directory. Database dumps from the main Redis instance will be mapped into the directory `setup/docker/redis_main_data/`.

The app should now be running on [localhost](http://localhost).


### How to install a production server

See [this tutorial](http://blog.enketo.org/install-enketo-production-ubuntu/) for detailed instructions. Another option, for some people, is to deploy with [Heroku](./doc/heroku.md).

### How to configure

All configuration is normally done in config/config.json. This file only has to contain the [default properties](./config/default-config.json) that you'd like to override. For some it may be preferrable to include all properties, to avoid surprises when the default configuration changes. Others may want to reduce hassle and keep the config.json as small as possible to automatically deploy configuration changes (e.g. new widgets). After editing the configuration, the app will need to be restarted.

As an alternative, there is an option to use environment variables instead of a config/config.json file. If the config/config.json file is missing Enketo will assume configuration is done with environment variables. A combination of both options is not supported. See [config/sample.env](./config/sample.env) for more information on equivalent environment variable names.

The default production configuration includes 2 redis instances. You can **greatly simplify installation by using 1 redis instance** instead (for non-production usage). To do this set the redis.cache.port to 6379 (same as redis.main.port). To set up 2 instances properly for production, you might find the vagrant setup steps in [bootstrap.sh](./setup/bootstrap.sh) useful.

For detailed guidance on each configuration item, see [this document](./config/README.md).

To configure your own custom external authentication also see [this section](#authentication).


### API

**Always** use the API to obtain webform URLs. Never try to craft or manipulate Enketo webform URLs yourself. This will make your Enketo integration future proof in case the URL structure changes. The API is stable, but webform URLs definitely are not.

The API is accessible on **/api/v2** and **/api/v1**. See the [documentation](http://apidocs.enketo.org) on how to use it.


### How to run
Run with `npm start` from project root.

You can now check that the app is running by going to e.g. http://localhost:8005 (depending on your server and port set in config/config.json or the port forwarding set up in Vagrant (default is 8006))

For a production server, we recommend using [pm2](https://github.com/unitech/pm2) or [forever](https://github.com/foreverjs/forever) to manage the node app.


### How to update

* update git repository with `git pull` (Check out a specific release (git tag) for a production server)
* update dependencies with `npm install --production` (This will run the CSS/JS builds automatically as well. If not, use `grunt` manually afterwards). You may have to remove `package-lock.json`.
* restart app


### Developer tools
* Install [nodemon](https://github.com/remy/nodemon) to automatically restart the server when a file changes.
* Install [gulp](http://gulpjs.com/) to automatically update the translation keys.
* Install [mocha](https://github.com/mochajs/mocha) to run tests.

The easiest way to start the app in development and debugging mode with livereload is with `grunt develop`.


### Browser support

See [this faq](https://enketo.org/faq/#browsers).

**Enketo endeavors to show a helpful (multi-lingual) error message on unsupported browsers when the form is loaded to avoid serious issues.**


### Themes
 
The default theme can be set in config/config.json. The default theme can be overridden in [the form definition](http://xlsform.org/#grid). 

The recommended way to customize themes is to either:

 * Create an issue (and fund or send a pull request) for changes to the existing themes, or
 * Create your own theme in your own enketo-express port and add your custom theme in its own folder [here](app/views/styles). No other changes are required. A succesful rebuild with `grunt`, and your theme will become active when the app starts. The advantage of using this method instead of editing the existing themes, is that you will not have merge conflicts when you update your port! Add a print-specific version of your theme and use the same filenaming convention as the built-in themes.

 See also [this further guidance](https://github.com/enketo/enketo-core#notes-for-css-developers).


### Authentication

This app can manage [OpenRosa form authentication](https://bitbucket.org/javarosa/javarosa/wiki/AuthenticationAPI) for protected forms, i.e. it is possible to log in to forms with credentials set in your OpenRosa Server (e.g. Aggregate/KoBo), just like in ODK Collect. 

Alternatively, you could make use various _external authentication_ methods, i.e. using the authentication management of your form and data server.

For more information see [this documentation page](https://enketo.org/develop/auth/) and the [configuration documentation](./config/README.md#linked-form-and-data-server).

### Security

There are two major security considerations to be aware of. Both of these result in the need to run this application on **https** with a valid SSL certificate.

_API security_ is mainly arranged by the secret API key set up in config/config.json. This API key is sent in **cleartext** to Enketo by the form/data server (such as ODK Aggregate) and can easily be intercepted and read _if the transport is not secure_. Somebody could start using your Enketo Express installation for their own form/data server, or obtain the URLs of your forms. Using secure (https) transport mitigates against this hazard. Security increases as well by populating the _server url_ in config/config.json. Also, don't forget to change your API key when you start running Enketo Express in production.

_Form authentication_ is only secure when Enketo is running on **https**. To avoid leaking form server credentials, authentication is automatically disabled when the app is accessed in a 'production' environment on 'http'. If you **have to** to run the app on http in a production environment, you can bypass this security by setting `"allow insecure transport": true` in config/config.json. The only use case this would be acceptable in is when running the app on a local protected network (e.g. in the KoBo VM).


### Translation

The user interface was translated by: Viktor S. (Russian), Alexander Torrado Leon (Spanish), Peter Smith (Portugese, Spanish), sPrzemysław Gumułka (Polish), Niklas Ljungkvist, Sid Patel (Swedish), Katri Jalava (Finnish), Francesc Garre (Spanish), Sounay Phothisane (Lao), Linxin Guo (Chinese), Emmanuel Jean, Renaud Gaudin (French), Trần Quý Phi (Vietnamese), Reza Doosti, Hossein Azad, Davood Mottalee (Persian), Tomas Skripcak (Slovak, Czech, German), Daniela Baldova (Czech), Robert Michael Lundin (Norwegian), Margaret Ndisha, Charles Mutisya (Swahili), Panzero Mauro (Italian), Gabriel Kreindler (Romanian), Jason Reeder, Omar Nazar, Sara Sameer, David Gessel (Arabic), Tino Kreutzer (German), Wasilis Mandratzis-Walz (German, Greek), Luis Molina (Spanish), Martijn van de Rijdt (Dutch).

_Send a message if you'd like to contribute! We use an easy web interface provided by [Transifex](https://www.transifex.com/projects/p/enketo-express/)._


### Funding

The development of this application was funded by [KoBo Toolbox (Harvard Humanitarian Initiative)](http://www.kobotoolbox.org), [iMMAP](http://immap.org), [OpenClinica](https://openclinica.com), and [Enketo LLC](https://enketo.org). The [Enketo-core](https://github.com/enketo/enketo-core) library (the form engine + themes) used in this application obtained significant funding from [SEL (Columbia University)](http://modi.mech.columbia.edu/), the [Santa Fe Institute](http://www.santafe.edu/), [Ona](https://ona.io) and the [HRP project](http://www.who.int/reproductivehealth/topics/mhealth/en/). 

### License

See [the license document](LICENSE) for this application's license.

Note that some of the libraries used in this app have a different license. In particular note [this one](https://github.com/enketo/enketo-xpathjs).

Note the 'Powered by Enketo' footer requirement as explained in [enketo-core](https://github.com/enketo/enketo-core#license). This requirement is applicable to all Enketo apps, including this one, unless an exemption was granted.

The Enketo logo and Icons are trademarked by [Enketo LLC](https://www.linkedin.com/company/enketo-llc) and should only be used for the 'Powered by Enketo' requirement mentioned above (if applicable). To prevent infringement simply replace the logo images in [/public/images](/public/images) with your own or contact [Enketo LLC](mailto:info@enketo.org) to discuss the use inside your app.


### Change log

See [change log](./CHANGELOG.md)
