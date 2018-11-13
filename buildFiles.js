const pkg = require( './package' );
const entries = pkg.entries;
const bundles = entries.map( file => file.replace( '/src/', '/build/' ).replace( '.js', '-bundle.js' ) );

module.exports = {
    entries,
    bundles
};
