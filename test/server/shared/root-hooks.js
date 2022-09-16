const { flush, select, client } = require('../../../app/lib/db');

const { REDIS_DB } = process.env;

/** @type {number | null} */
let redisDB = null;

if (REDIS_DB != null && /^(\d|1[0-5])$/.test(REDIS_DB)) {
    redisDB = Number(REDIS_DB);
}

module.exports = {
    mochaHooks: {
        async beforeEach() {
            if (redisDB != null) {
                await select(redisDB);
            }
        },

        async afterEach() {
            await flush();
        },

        afterAll() {
            client.end(true);
            client.unref();
        },
    },
};
