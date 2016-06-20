Heroku deployment
=======================

### First time

1. Install and configure the Heroku Toolbelt.
2. Clone Enketo Express.
3. Create your Heroku application from your Enketo Express folder with `heroku create`.
4. Configure Enketo (see next section). The absolute minimum is setting `ENKETO_LINKED_FORM_AND_DATA_SERVER_SERVER_URL=`. This could be an empty value.
5. Create main database with `heroku addons:create heroku-redis:premium-0 --as enketo_redis_main`.
6. Create cache database with `heroku addons:create heroku-redis:premium-0 --as enketo_redis_cache`. Note that _heroku-redis:premium-0_ is persistent which is actually not necessary, but won't hurt either.
7. Start web server with `heroku ps:scale web=1`. For multiple dynos upgrade to Standard or Performance first. You'll likely have to upgrade your heroku redis addons as well, at least the one containing the main database (e.g. with `heroku addons:upgrade enketo_redis_main:premium-1` - this takes several minutes to complete).
8. Push code to Heroku with `git push heroku master`.
9. Check the logs while it's running. You may have to upgrade the redis addons (error: too many connections) or memory (error: memory quota exceeded)!

### Heroku configuration 

On Heroku, the regular config.json configuration should not be used (and not be created). Instead Enketo is configured with environment variables using `heroku config:set`. Just like with config.json, these environment variables will overwrite the default configuration set in [default-config.json](../config/default-config.json). To read how each configuration variable can be set using a (flat) configuration variable name, see [sample.env](../config/sample.env).

Enketo's JS and CSS **build process** uses configuration variables. This means that every time an environment variable (that is used in browser scripts) is changed, **Enketo needs to rebuild**. In Heroku rebuilds are always triggered with a git push. If there is nothing to push you'll therefore trick Heroku by pushing an empty commit like this: `git commit --allow-empty -m "empty commit"`.

### Redis connections

The key sizing criterion for redis addons seems to be the number of simultaneous database connections. It seems Enketo on heroku is using about 26 connections for _enketo\_redis\_main_ and 18 for _enketo\_redis\_cache_per dyno (8 threads) soon after starting up the app.

### Warning: before upgrading or downgrading heroku-redis

Before upgrading or downgrading your heroku-redis addon, shut down your server with `heroku ps:scale web=0`. This avoids 2 potential issues:

1. Any data written to redis during the upgrade/downgrade might get lost forever.
2. At the time of writing (June 2016), a gigantic bug in heroku-redis seems to cause **all data to get lost forever** if the app is in a panic state due to an _Error: Amount of redis connections exceeds maximum allowed_. This panic state is causing Enketo Express forks to die and continuously re-incarnate.

### Advantages of using Heroku

1. Fastest possible deployment of your own Enketo server.
2. Easy scaling.
3. Reliable, presumably.

### Disadvantages of using Heroku

1. Expensive.
2. Initial Enketo configuration is more cumbersome (editing a structured json file is just easier and more user-friendly).
3. Little control. Requires trust (e.g. for database backups) and relying on support (e.g. for database restoration).
