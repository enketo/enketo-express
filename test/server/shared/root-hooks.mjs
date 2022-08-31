import { spawn } from 'child_process';
import net from 'node:net';
import sinon from 'sinon';
import { promisify } from 'node:util';
import { server as config } from '../../../app/models/config-model.js';

/**
 * @return {Promise<number>}
 */
const getAvailablePort = () => {
    const server = net.createServer();

    return new Promise((resolve, reject) => {
        server.listen(0, () => {
            const { port } = server.address();

            server.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(port);
                }
            });
        });

        server.once('error', (error) => {
            server.close(() => {
                reject(error);
                server.unref();
            });
        });
    });
};

/**
 * @type {number} port
 */
const startRedisServer = async (port) =>
    new Promise((resolve, reject) => {
        let isSettled = false;

        const server = spawn('redis-server', ['--port', String(port)]);

        server.stdout.once('data', () => {
            if (!isSettled) {
                resolve(server);
                isSettled = true;
            }
        });

        server.once('spawn', () => {
            if (!isSettled) {
                resolve(server);
                isSettled = true;
            }
        });

        server.once('error', (error) => {
            if (!isSettled) {
                reject(error);
                isSettled = true;
            }
        });

        return server;
    });

const [mainPort, cachePort] = await Promise.all([
    getAvailablePort(),
    getAvailablePort(),
]);

const redisServerProcesses = await Promise.all([
    startRedisServer(mainPort),
    startRedisServer(cachePort),
]);

const sandbox = sinon.createSandbox();

sandbox.stub(config.redis.main, 'port').value(mainPort);
sandbox.stub(config.redis.cache, 'port').value(cachePort);

const { mainClient, cacheClient } = await import('../../../app/lib/db.js');

const flush = async () => {
    const flushMainClient = promisify(mainClient.flushdb).bind(mainClient);
    const flushCacheClient = promisify(cacheClient.flushdb).bind(cacheClient);

    await Promise.all([flushMainClient(), flushCacheClient()]);
};

export default {
    async afterEach() {
        await flush();
        // await Promise.all([mainClientFlush(), cacheClientFlush()]);
    },

    async afterAll() {
        await Promise.all(
            redisServerProcesses.map((process) => {
                process.kill(0);
            })
        );

        mainClient.end(true);
        mainClient.unref();
        cacheClient.end(true);
        cacheClient.unref();

        sandbox.restore();
    },
};
