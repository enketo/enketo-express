#!/bin/sh -u

# exit if an error occurs
set -e

# If the repo directory hasn't been externally specified, default to `/vagrant`.
ENKETO_EXPRESS_REPO_DIR=${ENKETO_EXPRESS_REPO_DIR:-"/vagrant"}

ENKETO_EXPRESS_UPDATE_REPO=${ENKETO_EXPRESS_UPDATE_REPO:-"true"}
ENKETO_EXPRESS_USE_NODE_ENV=${ENKETO_EXPRESS_USE_NODE_ENV:-"false"}

# install redis
echo 'Installing redis...'
apt-get update
apt-get upgrade -y
apt-get install -y redis-server

# further redis setup with persistence, security, logging, multiple instances, priming 
echo 'Setting up Redis instances...'
if [ -f "/etc/redis/redis.conf" ]; then
    systemctl stop redis
    systemctl disable redis
    systemctl daemon-reload

    mv /etc/redis/redis.conf /etc/redis/redis-origin.conf
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/conf/redis-enketo-main.conf /etc/redis/
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/conf/redis-enketo-cache.conf /etc/redis/
    systemctl enable redis-server@enketo-main.service
    systemctl enable redis-server@enketo-cache.service

    chown redis:redis /var/lib/redis/

    if [ -f "/var/lib/redis/redis.rdb" ]; then
	   rm /var/lib/redis/redis.rdb
    fi
    echo 'Copying enketo default redis db...'
    cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/enketo-main.rdb /var/lib/redis/
    chown redis:redis /var/lib/redis/enketo-main.rdb
    chmod 660 /var/lib/redis/enketo-main.rdb
fi

echo 'Starting first enketo redis instance (systemd)...'
sudo systemctl start redis-server@enketo-main.service

echo 'Starting second enketo redis instance (systemd)...'
sudo systemctl start redis-server@enketo-cache.service

# install dependencies, development tools, node, grunt
echo 'Installing some apt-get packages...'
apt-get install -y build-essential git python
echo 'Installing some more apt-get packages for puppeteer (PDF creation)...'
apt-get install -y gconf-service libasound2 libatk1.0-0 libatk-bridge2.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

echo 'Installing nodejs...'
cd $ENKETO_EXPRESS_REPO_DIR
if [ $ENKETO_EXPRESS_USE_NODE_ENV = "true" ]; then
    apt-get install python-pip
    pip install nodeenv
    nodeenv env
    . env/bin/activate
else
    curl -sL https://deb.nodesource.com/setup_12.x | sudo bash -
    apt-get install -y nodejs
fi

# Create a local configuration file unless it already exists
echo 'Copying custom configuration unless config.json already exists'
if [ ! -f "$ENKETO_EXPRESS_REPO_DIR/config/config.json" ]; then
    cp setup/config/config.json config/config.json
fi

# Remove node_modules if exists because npm builds can be system-specific 
# (if using both host and vm that would cause problems)
if [ -d "$ENKETO_EXPRESS_REPO_DIR/node_modules" ]; then
	rm -R $ENKETO_EXPRESS_REPO_DIR/node_modules
fi

# Install all the required Node packages
npm install -g grunt-cli nodemon mocha
npm install

# build js and css (not necessary because it's part of npm install)
# grunt

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

