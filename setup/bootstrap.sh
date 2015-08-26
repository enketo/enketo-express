#!/bin/sh -u

# exit if an error occurs
set -e

# If the repo directory hasn't been externally specified, default to `/vagrant`.
ENKETO_EXPRESS_REPO_DIR=${ENKETO_EXPRESS_REPO_DIR:-"/vagrant"}

ENKETO_EXPRESS_UPDATE_REPO=${ENKETO_EXPRESS_UPDATE_REPO:-"true"}
ENKETO_EXPRESS_USE_NODE_ENV=${ENKETO_EXPRESS_USE_NODE_ENV:-"false"}

# install redis
echo 'installing redis...'
add-apt-repository -y ppa:rwky/redis
apt-get update
apt-get install -y redis-server

# further redis setup with persistence, security, logging, multiple instances, priming 
echo 'copying enketo redis conf...'
if [ -f "/etc/redis/redis.conf" ]; then
    mv /etc/redis/redis.conf /etc/redis/redis-origin.conf
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/conf/redis-enketo-main.conf /etc/redis/
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/conf/redis-enketo-cache.conf /etc/redis/
    chown redis:redis /var/lib/redis/
    echo 'copying enketo redis-server configs...'
    mv /etc/init/redis-server.conf /etc/init/redis-server.conf.disabled
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/init/redis-server-enketo-main-vagrant.conf /etc/init/
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/init/redis-server-enketo-cache.conf /etc/init/
    if [ -f "/var/lib/redis/redis.rdb" ]; then
	   rm /var/lib/redis/redis.rdb
    fi
    echo 'copying enketo default redis db...'
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/enketo-main.rdb /var/lib/redis/
    chown redis:redis /var/lib/redis/enketo-main.rdb
    chmod 660 /var/lib/redis/enketo-main.rdb
fi
echo 'starting first enketo redis instance...'
service redis-server-enketo-main-vagrant restart
echo 'starting second enketo redis instance...'
service redis-server-enketo-cache restart

# install dependencies, development tools, node, grunt
apt-get install -y build-essential git libfontconfig
cd $ENKETO_EXPRESS_REPO_DIR
if [ $ENKETO_EXPRESS_USE_NODE_ENV = "true" ]; then
    apt-get install python-pip
    pip install nodeenv
    nodeenv env
    . env/bin/activate
else
    curl -sL https://deb.nodesource.com/setup_0.10 | sudo bash -
    apt-get install -y nodejs
fi
npm -g install grunt-cli node-gyp gulp nodemon mocha
npm -g install npm@next
# remove node_modules if exists because npm builds can be system-specific
if [ -d "$ENKETO_EXPRESS_REPO_DIR/node_modules" ]; then
	rm -R $ENKETO_EXPRESS_REPO_DIR/node_modules
fi
npm install

# create a local configuration file unless it already exists
echo 'copying custom configuration unless config.json already exists'
if [ ! -f "$ENKETO_EXPRESS_REPO_DIR/config/config.json" ]; then
    cp setup/config/config.json config/config.json
fi

# build js and css
grunt

# still installing pm2 but not using in script any more. Because it runs invisibly when started as root.
if [ $(whoami) = "root" ]; then
    npm install pm2@latest -g --unsafe-perm
else
    npm install pm2@latest -g
fi

echo "**************************************************************************************"
echo "***                        Enketo Express is installed!                           ****"
echo "***                                                                               ****"
echo "*** You can start it by ssh-ing into the VM and running: cd /vagrant && npm start ****"
echo "***                 ( or with: pm2 start /vagrant/app.js -n enketo )              ****"
echo "**************************************************************************************"

