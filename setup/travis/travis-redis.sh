#!/bin/sh

echo "Setting up Redis instances on ports 6379 and 6380..."

# echo "default redis conf"
# sudo cat /etc/redis/redis.conf

# echo "\n\ndefault redis service"
# cat /lib/systemd/system/redis-server.service

# Based on https://learn.jetrails.com/article/multiple-redis-servers-with-systemd

# Disable the default Redis service

sudo systemctl stop redis-server
sudo systemctl disable redis-server
sudo mkdir -p /etc/redis/{redis-server.pre-up.d,redis-server.post-down.d,redis-server.post-up.d,redis-server.pre-down.d}
sudo mkdir -p /var/lib/{redis-cache,redis-sessions}

# Redis config

REDIS_SOURCE=${TRAVIS_BUILD_DIR}/setup/redis/conf
REDIS_TARGET=/etc/redis

sudo cat $REDIS_SOURCE/redis-enketo-cache.conf | grep -v "^supervised systemd" > $REDIS_SOURCE/redis-travis-cache.conf
sudo cp -f $REDIS_SOURCE/redis-travis-cache.conf $REDIS_TARGET/enketo-cache.conf

sudo cat $REDIS_SOURCE/redis-enketo-main.conf | grep -v "^supervised systemd" > $REDIS_SOURCE/redis-travis-main.conf
sudo cp -f $REDIS_SOURCE/redis-travis-main.conf $REDIS_TARGET/enketo-main.conf

# Systemd config

SYSTEMD_SOURCE=${TRAVIS_BUILD_DIR}/setup/redis/systemd
SYSTEMD_TARGET=/lib/systemd/system

sudo cp $SYSTEMD_SOURCE/redis-enketo-cache.service $SYSTEMD_TARGET/redis-enketo-cache.service
sudo cp $SYSTEMD_SOURCE/redis-enketo-main.service $SYSTEMD_TARGET/redis-enketo-main.service


echo "Starting up outside Systemd service"
time /usr/bin/redis-server /etc/redis/enketo-cache.conf --supervised no --daemonize yes
echo "Did daemonize??"


# Enable and start Redis services

sudo systemctl enable redis-enketo-cache.service redis-enketo-main.service
sudo systemctl start redis-enketo-cache.service redis-enketo-main.service || systemctl status redis-enketo-cache.service && journalctl -xe

echo "/var/log/redis/redis-enketo-cache.log:"
sudo cat /var/log/redis/redis-enketo-cache.log

echo "/var/log/redis/redis-enketo-main.log:"
sudo cat /var/log/redis/redis-enketo-main.log

redis-cli -p 6379 ping

MAIN_STATUS=$?

if [ "$MAIN_STATUS" = "0" ]
then
    echo "Redis is running on port 6379"
else
    echo "Redis failed to start on port 6379"
    cat /var/log/redis/redis-enketo-cache.log
    exit 1
fi

redis-cli -p 6380 ping

CACHE_STATUS=$?

if [ "$CACHE_STATUS" = "0" ]
then
    echo "Redis is running on port 6380"
else
    echo "Redis failed to start on port 6380"
    cat /var/log/redis/redis-enketo-cache.log
    exit 1
fi
