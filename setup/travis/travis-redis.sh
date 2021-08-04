#!/bin/sh

echo "Setting up Redis instances on ports 6379 and 6380..."

# Based on setup/vagrant/bootstrap.sh

systemctl stop redis
systemctl disable redis
systemctl daemon-reload

REDIS_SOURCE=${TRAVIS_BUILD_DIR}/setup/redis/conf

cp -f $REDIS_SOURCE/redis-enketo-main.conf /etc/redis/
cp -f $REDIS_SOURCE/redis-enketo-cache.conf /etc/redis/

sudo systemctl enable redis-server@enketo-main.service redis-server@enketo-cache.service
sudo systemctl start redis-server@enketo-main.service redis-server@enketo-cache.service
