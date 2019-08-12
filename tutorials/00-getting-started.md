### How to install a test/development server

#### Manually:

1. Install JS prerequisites: [Node.js](https://github.com/nodesource/distributions) (8.x LTS), [Grunt Client](http://gruntjs.com).
2. Install [Redis](http://redis.io/topics/quickstart)
3. Install build-essential, curl and git with `(sudo) apt-get install build-essential git curl`
4. Clone this repository
5. Create config/config.json to override values in the [default config](https://github.com/enketo/enketo-express/blob/master/config/default-config.json). Start with `cp config/default-config.json config/config.json`
6. Install dependencies and build with `npm install` from the project root

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
2. Create a [config file](https://github.com/enketo/enketo-express/blob/master/config/) at `config/config.json` specifying at minimum an API key.
3. **(Optional)** For HTTPS, copy your SSL certificate and key files to `setup/docker/secrets/ssl.crt` and `setup/docker/secrets/ssl.key` respectively (take care not to commit these files back to any public git repository). Plain HTTP requests to Enketo Express will be automatically redirected to HTTPS.
4. Execute `docker-compose up -d` from the [`setup/docker`](https://github.com/enketo/enketo-express/blob/master/setup/docker) directory and wait to see e.g. `Worker 1 ready for duty...`.
5. To stop, execute `docker-compose stop` from the [`setup/docker`](https://github.com/enketo/enketo-express/blob/master/setup/docker) directory. Database dumps from the main Redis instance will be mapped into the directory `setup/docker/redis_main_data/`.

The app should now be running on [localhost](http://localhost).

### How to install a production server

See [this tutorial](http://blog.enketo.org/install-enketo-production-ubuntu/) for detailed instructions. Another option, for some people, is to deploy with [Heroku](https://github.com/enketo/enketo-express/blob/master/tutorials/13-heroku.md).

### How to configure

All configuration is normally done in config/config.json. This file only has to contain the [default properties](https://github.com/enketo/enketo-express/blob/master/config/default-config.json) that you'd like to override. For some it may be preferrable to include all properties, to avoid surprises when the default configuration changes. Others may want to reduce hassle and keep the config.json as small as possible to automatically deploy configuration changes (e.g. new widgets). After editing the configuration, the app will need to be restarted.

As an alternative, there is an option to use environment variables instead of a config/config.json file. If the config/config.json file is missing Enketo will assume configuration is done with environment variables. A combination of both options is not supported. See [config/sample.env](https://github.com/enketo/enketo-express/blob/master/config/sample.env) for more information on equivalent environment variable names.

The default production configuration includes 2 redis instances. You can **greatly simplify installation by using 1 redis instance** instead (for non-production usage). To do this set the redis.cache.port to 6379 (same as redis.main.port). To set up 2 instances properly for production, you might find the vagrant setup steps in [bootstrap.sh](https://github.com/enketo/enketo-express/blob/master/setup/bootstrap.sh) useful.

For detailed guidance on each configuration item, see [this document](https://github.com/enketo/enketo-express/blob/master/tutorials/10-configuration.md).

To configure your own custom external authentication also see [this document](https://github.com/enketo/enketo-express/blob/master/tutorials/30-authentication-and-security.md).

### How to run

Run with `npm start` from project root.

You can now check that the app is running by going to e.g. http://localhost:8005 (depending on your server and port set in config/config.json or the port forwarding set up in Vagrant (default is 8006))

For a production server, we recommend using [pm2](https://github.com/unitech/pm2) or [forever](https://github.com/foreverjs/forever) to manage the node app.
