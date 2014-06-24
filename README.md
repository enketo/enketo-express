enketo-express [![Build Status](https://travis-ci.org/kobotoolbox/enketo-express.png)](https://travis-ci.org/kobotoolbox/enketo-express)
==============

A super light-weight node.js version of Enketo Smart Paper developed for KoBo Toolbox. Chock-full of badass rockstar tech.

### How to install (anywhere)

* install [Node.js](http://nodejs.org/) 0.10.x (issue with 0.11.x) if you don't have it already (check with `node -v`)
* install [Grunt Client](http://gruntjs.com) 4.4.x globally with `npm install -g grunt-cli` if you don't have it already (check with `grunt --version`)
* install [Redis](http://redis.io/topics/quickstart)
* install libxslt and libxml2 with `(sudo) apt-get install libxml2-dev libxslt1-dev`
* clone this repository
* clone git submodules (I think) with `git submodule update --init --recursive`
* install dependencies with `npm install` from the project root
* build with `grunt` from the project root

### How to install as a local VirtualBox VM - the easy way
1. [Install Vagrant](http://docs.vagrantup.com/v2/installation/index.html)
2. [Install VirtualBox](https://www.virtualbox.org/wiki/Downloads)
3. clone enketo-express
4. cd to enketo-express location
5. run `vagrant up`
6. ssh into VM with `vagrant ssh` (enketo-express is located in /vagrant and the port is 8015)

### How to run
* run with `node .` or `npm start` from project root
* you can now check that the app is running by going to e.g. http://localhost:8005 (depending on your server and port set in [config.json](./config.json) or the port forwarding set up (with the default Vagrantfile the port is 8015))

### How to update
* update git repository with `git pull -v`
* update git submodules with `git submodule update --init --recursive`
* re-build with `grunt`

### Developer tools
* install nodemon (`npm install -g nodemon`) to automatically restart the server when a file changes
* the easiest way to start the app in development and debugging mode with livereload is with `grunt develop` 

### Differences with [MartijnR/enketo](https://github.com/MartijnR/enketo) 

* \+ this one is 100% JavaScript
* \+ this one is much easier to install
* \+ this one will have cross-browser (media) file inputs (eventually)
* \- this one will not store the application in your browser for offline launch - it requires a constant connection to the server (this server may be on a local network though)
* \- this one will not store records locally in your browser - it will submit records immediately to the server
* \- this one will not store draft records (see previous)

### Additional differences with the full-fledged service at [enketo.org](https://enketo.org)

* \- no form authentication
* \- no Grid Theme
* \- no /forms app
* \- no /formtester app

### License

See [LICENSE](LICENSE) for this application's license.

Note that some of the libraries used in this app have different licenses.

The Enketo logo and Icons are trademarked by Enketo LLC. They can be used in the KoBoCAT VM only. If you are using this app to build your own web application, you are encouraged to maintain the 'powered by Enketo' form footer with the Enketo logo, but replace other images in [/public/images](/public/images) with your own or contact [Enketo LLC](mailto:info@enketo.org) to discuss the use inside your app.
