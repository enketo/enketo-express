#!/bin/sh

echo "Setting up Redis instances on ports 6379 and 6380..."

# Ensure config.json exists (this addresses some inconsistencies seen in test output)

CONFIG_DIR=${TRAVIS_BUILD_DIR}/config
CONFIG_PATH="${CONFIG_DIR}/config.json"

test -f "$CONFIG_PATH" || cat ${CONFIG_DIR}/default-config.json $CONFIG_PATH

# Start Redis instances with Enketo configs, overriding `supervised systemd`

REDIS_DIR=${TRAVIS_BUILD_DIR}/setup/redis/conf

sudo /usr/bin/redis-server $REDIS_DIR/redis-enketo-cache.conf --supervised no
sudo /usr/bin/redis-server $REDIS_DIR/redis-enketo-main.conf --supervised no

redis-cli -p 6379 ping

MAIN_STATUS=$?

if [ "$MAIN_STATUS" = "0" ]
then
    echo "Redis is running on port 6379"
else
    echo "Redis failed to start on port 6379"
    exit 1
fi

redis-cli -p 6380 ping

CACHE_STATUS=$?

if [ "$CACHE_STATUS" = "0" ]
then
    echo "Redis is running on port 6380"
else
    echo "Redis failed to start on port 6380"
    exit 1
fi
