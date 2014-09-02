#!/bin/sh -u

# exit if an error occurs
set -e

# If the repo directory hasn't been externally specified, default to `/vagrant`.
ENKETO_EXPRESS_REPO_DIR=${ENKETO_EXPRESS_REPO_DIR:-"/vagrant"}

ENKETO_EXPRESS_UPDATE_REPO=${ENKETO_EXPRESS_UPDATE_REPO:-"true"}

# install redis
echo 'installing redis...'
add-apt-repository -y ppa:rwky/redis
apt-get update
apt-get install -y redis-server

# update repo
echo 'updating enketo app to latest version'
apt-get install -y git
cd $ENKETO_EXPRESS_REPO_DIR
# The next line should be commented out during development or any case where the repository was cloned via the ssh URL (i.e. git@github.com:kobotoolbox/enketo-express.git) as opposed to the HTTPS.
[ $ENKETO_EXPRESS_UPDATE_REPO = "true" ] && git pull
git submodule update --init --recursive

# further redis setup with persistence, security, logging, multiple instances, priming 
stop redis-server
echo 'copying enketo redis conf...'
mv /etc/redis/redis.conf redis-origin.conf
cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/conf/redis-enketo-main.conf /etc/redis/
cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/conf/redis-enketo-cache.conf /etc/redis/
chown redis:redis /var/lib/redis/
echo 'copying enketo redis-server configs...'
mv /etc/init/redis-server.conf /etc/init/redis-server.conf.disabled
cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/init/redis-server-enketo-main.conf /etc/init/
cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/init/redis-server-enketo-cache.conf /etc/init/
if [ -f "/var/lib/redis/redis.rdb"]; then
	rm /var/lib/redis/redis.rdb
fi
echo 'copying enketo default redis db...'
cp -f $ENKETO_EXPRESS_REPO_DIR/setup/redis/enketo-main.rdb /var/lib/redis/
chown redis:redis /var/lib/redis/enketo-main.rdb
chmod 660 /var/lib/redis/enketo-main.rdb
echo 'starting first enketo redis instance...'
service redis-server-enketo-main start
echo 'starting second enketo redis instance...'
service redis-server-enketo-cache start

# install XML prerequisites for node_xslt
apt-get install -y libxml2-dev libxslt1-dev

# install dependencies, development tools, node, grunt
apt-get install -y python-software-properties python g++ make
add-apt-repository ppa:chris-lea/node.js
apt-get update
apt-get install -y nodejs
npm install -g grunt-cli nodemon mocha
cd $ENKETO_EXPRESS_REPO_DIR
# remove node_modules if exists because npm builds can be system-specific
if [ -d "$ENKETO_EXPRESS_REPO_DIR/node_modules" ]; then
	rm -R $ENKETO_EXPRESS_REPO_DIR/node_modules
fi
npm install 

# build js and css
grunt symlink
grunt compile

# start in background and keep restarting if it fails until `pm2 stop enketo` is called
# developers may want to comment this out
[ $(whoami) = "root" ] && npm install pm2@latest -g --unsafe-perm
[ ! $(whoami) = "root" ] && npm install pm2@latest -g
pm2 start app.js -n enketo
echo "*************************************************************************************"
echo "***                    Enketo Express should now have started!                   ****"
echo "***                                                                              ****"
echo "***   You can terminate it by ssh-ing into the VM and running: pm2 stop enketo   ****"
echo "*************************************************************************************"

