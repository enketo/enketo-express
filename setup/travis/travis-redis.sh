#!/bin/sh

echo "Setting up Redis instances on ports 6379 and 6380..."

# Based on setup/vagrant/bootstrap.sh

sudo systemctl stop redis-server
sudo systemctl disable redis-server
sudo systemctl daemon-reload

REDIS_SOURCE=${TRAVIS_BUILD_DIR}/setup/redis/conf

sudo cp -f $REDIS_SOURCE/redis-enketo-main.conf /etc/redis/
sudo cp -f $REDIS_SOURCE/redis-enketo-cache.conf /etc/redis/

sudo cp -f ${TRAVIS_BUILD_DIR}/setup/redis/systemd/redis-server@.target /etc/systemd/system/

sudo systemctl enable redis-server@enketo-main.service redis-server@enketo-cache.service
sudo systemctl start redis-server@enketo-main.service redis-server@enketo-cache.service
