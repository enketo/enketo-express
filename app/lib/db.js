const redis = require('redis');
const config = require('../models/config-model').server;
/**
 * Creates the redis url passed into the client, taking the URL as is if defined, otherwise building the url from
 * the predefined host, port and option auth token
 *
 * @static
 * @param { object } redisConfig - Local redis configuration settings imported from the config model.
 * @return { string } Redis url
 */

function _getRedisUrl(redisConfig) {
    if (redisConfig.url) {
        return redisConfig.url
    }
    else {
        return `redis://:${redisConfig.password}@${redisConfig.host}:${redisConfig.port}`
    }
}

const mainClient = redis.createClient(_getRedisUrl(config.redis.main))
const cacheClient = redis.createClient(_getRedisUrl(config.redis.cache))
module.exports = {
    mainClient,
    cacheClient,
};
