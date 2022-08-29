const redis = require('redis');
const { promisify } = require('util');
const config = require('../models/config-model').server;

const client = redis.createClient(
    config.redis.cache.port,
    config.redis.cache.host,
    {
        auth_pass: config.redis.cache.password,
    }
);

const get = promisify(client.get).bind(client);
const set = promisify(client.set).bind(client);
const expire = promisify(client.expire).bind(client);
const flush = promisify(client.flushdb).bind(client);

module.exports = {
    client,
    get,
    set,
    expire,
    flush,
};
