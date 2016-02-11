'use strict';

// Don't use native promises at all until they are fully supported across browsers (IE, Safari).
global.Promise = require( 'lie' );
