enketo-express [![Build Status](https://travis-ci.org/kobotoolbox/enketo-express.png)](https://travis-ci.org/kobotoolbox/enketo-express) [![Dependency Status](https://david-dm.org/kobotoolbox/enketo-express.png)](https://david-dm.org/kobotoolbox/enketo-express)
==============

![Enketo Logo](public/images/logo.png "Enketo Logo")

A super light-weight node.js version of Enketo Smart Paper developed for KoBo Toolbox. Chock-full of [badass rockstar tech](https://www.youtube.com/watch?v=bzkRVzciAZg).

### How to install (anywhere)


1. Install JS prerequisites: [Node.js 0.10.x](http://nodejs.org/) (not 0.11), [Grunt Client](http://gruntjs.com), and [Bower](http://bower.io/)
2. Install [Redis](http://redis.io/topics/quickstart)
3. Install libxslt and libxml2 with `(sudo) apt-get install libxml2-dev libxslt1-dev`
4. Clone this repository
5. Clone git submodules with `git submodule update --init --recursive`
6. install dependencies with `npm install` and `bower install` from the project root
7. Build with `grunt` from the project root

### How to install as a local VirtualBox VM - the easy way
1. Install [Vagrant](http://docs.vagrantup.com/v2/installation/index.html) and [VirtualBox](https://www.virtualbox.org/wiki/Downloads)
2. Clone this repository 
3. Run `vagrant up` from the enketo-express folder and wait until it completes \* 
4. The app should now be running on http://localhost:8006 (to stop: run `pm2 stop enketo` from VM)

_\* sometimes `vagrant up` fails for reasons beyond our control - e.g. if external resources are temporarily unavailable. Try running `vagrant reload --provision` to resolve this._

### How to configure

All configuration is done in [config.json](./config/config.json). The configuration items mostly have self-explanatory names and sample values

The `maps` configuration can include an array of Mapbox TileJSON objects (or a subset of these with at least a tiles (array) and an attribution property)

The default production config includes 2 redis instances for the cache. You can **greatly simplify installation by using 1 redis instance** instead (for non-production usage). To do this set the redis.cache.port to 6379 (same as redis.main.port). To set up 2 instances properly for production, you'll find the vagrant setup steps in [bootstrap.sh](./setup/bootstrap.sh) useful.

The API is accessible on **/api/v1**

### How to run
Run with `npm start` from project root.

You can now check that the app is running by going to e.g. http://localhost:8005 (depending on your server and port set in [config.json](./config/config.json) or the port forwarding set up in Vagrant (default is 8006))

For a production server, we recommend using [pm2](https://github.com/unitech/pm2) to manage the node app.

### How to update
* update git repository with `git pull`
* update git submodules with `git submodule update --init --recursive`
* re-build with `grunt`

### Developer tools
Install [nodemon](https://github.com/remy/nodemon) to automatically restart the server when a file changes.

The easiest way to start the app in development and debugging mode with livereload is with `grunt develop`. If you are developing using the vagrant VM, make sure to `pm2 kill` first or comment out the pm2 block at the end in the [bootstrap](/setup/bootstrap.sh) script before creating the VM.

### Differences with [enketo/enketo](https://github.com/enketo/enketo) 

* \+ this one is 100% JavaScript
* \+ this one is much easier to install
* \+ this one has cross-browser (media) file inputs
* \- this one will not store the application in your browser for offline launch - it requires a constant connection to the server (this server may be on a local network though)
* \- this one will not store records locally in your browser - it will submit records immediately to the server
* \- this one will not store draft records (see previous)

### Additional differences with the full-fledged service at [enketo.org](https://enketo.org)

* \- no form authentication
* \- no [Grid Theme](http://blog.enketo.org/gorgeous-grid/)
* \- no [Forms](https://enketo.org/forms) app
* \- no [Formtester](https://enketo.org/formtester) app

### License

See [LICENSE](LICENSE) for this application's license.

Note that some of the libraries used in this app have different licenses.

The Enketo logo and Icons are trademarked by [Enketo LLC](https://www.linkedin.com/company/enketo-llc). They can be used in the KoBoCAT VM only. If you are using this app to build your own web application, you are encouraged to maintain the 'powered by Enketo' form footer with the Enketo logo, but replace other images in [/public/images](/public/images) with your own or contact [Enketo LLC](mailto:info@enketo.org) to discuss the use inside your app.
