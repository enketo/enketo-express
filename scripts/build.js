/* eslint-env node */

const esbuild = require('esbuild');
const config = require('../config/build.js');

esbuild.build(config);
