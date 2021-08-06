#!/bin/sh

echo "Setting up Redis instances on ports 6379 and 6380..."

# Start Redis instances with Enketo configs, overriding `supervised systemd`

CONFIG_DIR=${TRAVIS_BUILD_DIR}/setup/redis/conf

sudo /usr/bin/redis-server $CONFIG_DIR/redis-enketo-cache.conf --supervised no --daemonize yes
sudo /usr/bin/redis-server $CONFIG_DIR/redis-enketo-main.conf --supervised no --daemonize yes

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
