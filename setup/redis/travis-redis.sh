#!/bin/sh

echo "Setting up a second redis instance on port 6380..."

CONFIGPATH=${TRAVIS_BUILD_DIR}/setup/redis

sudo cp ${CONFIGPATH}/conf/redis-enketo-cache-upstart.conf /etc/redis/redis-enketo-cache.conf
sudo cp ${CONFIGPATH}/init/redis-server-enketo-cache.conf /etc/init/
sudo start redis-server-enketo-cache
sleep 3
