define( [ 'q' ], function( Q ) {
    "use strict";
    // TODO: test in old version of Safari and IE
    //if ( typeof window.Promise === 'undefined' ) {
    // don't use native promises at all until they are fully supported across browsers
    // I'm finding some issues when combining Q and native.
    //window.Promise = Q.Promise;
    //}
    window.Promise = Q.Promise;
    return true;
} );
