const chai = require('chai');

const { expect } = chai;
const fs = require('fs');
const path = require('path');
const sinon = require('sinon');
const childProcess = require('child_process');
const pkg = require('../../package.json');
const unCache = require('./require-uncache-helper');

const loadConfig = () => {
    unCache('../../app/models/config-model');

    return require('../../app/models/config-model');
};

describe('Config Model', () => {
    const themes = ['formhub', 'grid', 'kobo', 'plain'];

    /** @type {typeof import('../../app/models/config-model')} */
    let config;

    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    /** @type {string[]} */
    const assignedEnvKeys = [];

    /**
     * @param {string} key
     * @param {string} value
     */
    const stubEnv = (key, value) => {
        if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
            process.env[key] = undefined;
            assignedEnvKeys.push(key);
        }

        sandbox.stub(process.env, key).value(value);
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(console, 'warn').callsFake(() => {});

        stubEnv('NODE_ENV', 'test');

        config = loadConfig();
    });

    afterEach(() => {
        assignedEnvKeys.forEach((key) => {
            delete process.env[key];
        });

        assignedEnvKeys.length = 0;
        sandbox.restore();
    });

    it('should return default list of themes', () => {
        expect(config.getThemesSupported()).to.deep.equal(themes);
    });

    it('should return only specified themes if given a list of themes', () => {
        const themeList = ['formhub', 'grid'];
        expect(config.getThemesSupported(themeList)).to.deep.equal(themeList);
    });

    it('should return only valid theme list if given a list containing a wrong theme name', () => {
        const themeList = ['grid', 'plain', 'doesnotexist'];
        expect(config.getThemesSupported(themeList)).to.deep.equal([
            'grid',
            'plain',
        ]);
    });

    describe('can be set using flat environment variables instead of config.json', () => {
        const testStringValue = 'test';
        const localConfigPath = path.resolve(
            process.cwd(),
            './config/config.json'
        );

        beforeEach(() => {
            const readFileSync = fs.readFileSync.bind(fs);

            sandbox.stub(fs, 'readFileSync').callsFake((path, options) => {
                if (path === localConfigPath) {
                    throw new Error('File not found');
                }

                return readFileSync(path, options);
            });

            config = loadConfig();
        });

        it('for string values in a top level config item', () => {
            stubEnv('ENKETO_APP_NAME', testStringValue);
            config = loadConfig();
            expect(config.server['app name']).to.equal(testStringValue);
        });

        it('for boolean values in a top level config item', () => {
            expect(config.server['offline enabled']).to.equal(true);
            stubEnv('ENKETO_OFFLINE_ENABLED', 'false'); // string!
            config = loadConfig();
            expect(config.server['offline enabled']).to.equal(false);
        });

        it('for boolean values in a nested config item', () => {
            expect(
                config.server['linked form and data server']['legacy formhub']
            ).to.equal(false);
            stubEnv(
                'ENKETO_LINKED_FORM_AND_DATA_SERVER_LEGACY_FORMHUB',
                'true'
            ); // string!
            config = loadConfig();
            expect(
                config.server['linked form and data server']['legacy formhub']
            ).to.equal(true);
        });

        it('for null values', () => {
            expect(config.server.support.email).to.be.a('string');
            stubEnv('ENKETO_SUPPORT_EMAIL', 'null'); // string!
            config = loadConfig();
            expect(config.server.support.email).to.deep.equal(null);
        });

        it('for a config item that has a default value of null', () => {
            expect(config.server.redis.main.password).to.deep.equal(null);
            stubEnv('ENKETO_REDIS_MAIN_PASSWORD', testStringValue);
            config = loadConfig();
            expect(config.server.redis.main.password).to.deep.equal(
                testStringValue
            );
        });

        it('for a config item that has a default value of ""', () => {
            expect(config.server.google.analytics.ua).to.deep.equal('');
            stubEnv('ENKETO_GOOGLE_ANALYTICS_UA', testStringValue);
            config = loadConfig();
            expect(config.server.google.analytics.ua).to.deep.equal(
                testStringValue
            );
        });

        it('for array values that have default value of []', () => {
            stubEnv('ENKETO_THEMES_SUPPORTED_0', 'grid');
            stubEnv('ENKETO_THEMES_SUPPORTED_1', 'formhub');
            config = loadConfig();
            expect(config.server['themes supported']).to.deep.equal([
                'formhub',
                'grid',
            ]);
        });

        it('for array values that have a default first item only', () => {
            expect(config.server.maps[0].name).to.deep.equal('streets');
            expect(config.server.maps.length).to.deep.equal(1);
            stubEnv('ENKETO_MAPS_0_NAME', 'a');
            stubEnv('ENKETO_MAPS_1_NAME', 'b');
            stubEnv('ENKETO_MAPS_2_NAME', 'c');
            config = loadConfig();
            expect(config.server.maps.length).to.deep.equal(3);
            expect(config.server.maps[0].name).to.deep.equal('a');
            expect(config.server.maps[1].name).to.deep.equal('b');
            expect(config.server.maps[1].attribution).to.deep.equal('');
            expect(config.server.maps[2].name).to.deep.equal('c');
        });

        it('for nested array values that have a default first item only', () => {
            expect(config.server.maps[0].tiles.length).to.equal(1);
            stubEnv('ENKETO_MAPS_0_TILES_0', 'a');
            stubEnv('ENKETO_MAPS_0_TILES_1', 'b');
            stubEnv('ENKETO_MAPS_1_TILES_0', 'c');
            stubEnv('ENKETO_MAPS_2_TILES_0', 'd');
            stubEnv('ENKETO_MAPS_2_TILES_1', 'e');
            config = loadConfig();
            expect(config.server.maps.length).to.deep.equal(3);
            expect(config.server.maps[0].tiles).to.deep.equal(['a', 'b']);
            expect(config.server.maps[1].tiles).to.deep.equal(['c']);
            expect(config.server.maps[2].tiles).to.deep.equal(['d', 'e']);
        });

        it('parses a redis url to its components', () => {
            stubEnv(
                'ENKETO_REDIS_MAIN_URL',
                'redis://h:pwd@ec2-54-221-230-53.compute-1.amazonaws.com:6869'
            );
            config = loadConfig();
            expect(config.server.redis.main.host).to.equal(
                'ec2-54-221-230-53.compute-1.amazonaws.com'
            );
            expect(config.server.redis.main.port).to.equal('6869');
            expect(config.server.redis.main.password).to.equal('pwd');
        });
    });

    describe('version', () => {
        const execSync = childProcess.execSync.bind(childProcess);

        const configModelDir = path.dirname(
            require.resolve('../../app/models/config-model')
        );

        const tagsCommand = `cd ${configModelDir}; git describe --tags`;

        const tagFileCommand = 'head -1 .tag.txt';

        /** @type {Record<string, () => any>} */
        let execSyncCallbacks = {};

        beforeEach(() => {
            sandbox
                .stub(childProcess, 'execSync')
                .callsFake((command, options) => {
                    const callback = execSyncCallbacks[command];

                    if (callback != null) {
                        return callback();
                    }

                    return execSync(command, options);
                });
        });

        afterEach(() => {
            execSyncCallbacks = {};
        });

        it('populates the version from the latest git tag', () => {
            execSyncCallbacks[tagsCommand] = () => '1.2.3\n';

            config = loadConfig();

            expect(config.server.version).to.equal('1.2.3');
        });

        it('populates the version from the latest git tag (Buffer)', () => {
            execSyncCallbacks[tagsCommand] = () => Buffer.from('1.2.3\n');

            config = loadConfig();

            expect(config.server.version).to.equal('1.2.3');
        });

        it('populates the version from .tag.txt', () => {
            execSyncCallbacks[tagsCommand] = () => {
                throw new Error('No current tags');
            };
            execSyncCallbacks[tagFileCommand] = () => '1a27e89';

            config = loadConfig();

            expect(config.server.version).to.equal('1a27e89-r');
        });

        it('populates the version from .tag.txt (Buffer)', () => {
            execSyncCallbacks[tagsCommand] = () => {
                throw new Error('No current tags');
            };
            execSyncCallbacks[tagFileCommand] = () => Buffer.from('1a27e89');

            config = loadConfig();

            expect(config.server.version).to.equal('1a27e89-r');
        });

        it('removes a trailing newline from .tag.txt', () => {
            execSyncCallbacks[tagsCommand] = () => {
                throw new Error('No current tags');
            };
            execSyncCallbacks[tagFileCommand] = () => '1a27e89\n';

            config = loadConfig();

            expect(config.server.version).to.equal('1a27e89-r');
        });

        it('populates the version from package.json', () => {
            execSyncCallbacks[tagsCommand] = () => {
                throw new Error('No current tags');
            };
            execSyncCallbacks[tagFileCommand] = () => {
                throw new Error('Not found');
            };

            config = loadConfig();

            expect(config.server.version).to.equal(`${pkg.version}-p`);
        });
    });
});
