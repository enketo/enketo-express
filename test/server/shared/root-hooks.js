const { promisify } = require('util');
const { flush, client } = require('../../../app/lib/db');

const { REDIS_DB } = process.env;

/** @type {number | null} */
let redisDB = null;

if (REDIS_DB != null && /^(\d|1[0-5])$/.test(REDIS_DB)) {
    redisDB = Number(REDIS_DB);
}

const select = promisify(client.select).bind(client);

const selectRedisDB = async () => {
    if (redisDB != null) {
        await select(redisDB);
    }
};

module.exports = {
    mochaHooks: {
        async beforeEach() {
            await selectRedisDB();
        },

        async afterEach() {
            await selectRedisDB();
            await flush();
        },

        afterAll() {
            client.end(true);
            client.unref();
        },
    },
};
