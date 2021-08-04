#!/bin/sh

echo "Setting up Redis instances on ports 6379 and 6380..."


# Based on https://learn.jetrails.com/article/multiple-redis-servers-with-systemd

# Disable the default Redis service

sudo systemctl stop redis-server
sudo systemctl disable redis-server

# Redis config

REDIS_SOURCE=${TRAVIS_BUILD_DIR}/setup/redis/conf
REDIS_TARGET=/etc/redis
sudo cp $REDIS_SOURCE/redis-enketo-cache.conf $REDIS_TARGET/redis-enketo-cache.conf
sudo cp $REDIS_SOURCE/redis-enketo-main.conf $REDIS_TARGET/redis-enketo-main.conf

# Systemd config

SYSTEMD_SOURCE=${TRAVIS_BUILD_DIR}/setup/travis
SYSTEMD_TARGET=/lib/systemd/system
sudo cp $SYSTEMD_SOURCE/redis-enketo-cache.service $SYSTEMD_TARGET/redis-enketo-cache.service
sudo cp $SYSTEMD_SOURCE/redis-enketo-main.service $SYSTEMD_TARGET/redis-enketo-main.service

# Enable and start Redis services

sudo systemctl enable redis-enketo-cache.service redis-enketo-main.service
sudo systemctl start redis-enketo-cache.service redis-enketo-main.service
sudo journalctl -xe

# Wait for Redis services to start

sleep 3
