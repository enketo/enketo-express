'use strict';

// Don't use native promises at all until they are fully supported across browsers (IE, Safari).
// I'm finding some issues when combining Q and native.
global.Promise = require( 'q' ).Promise;
