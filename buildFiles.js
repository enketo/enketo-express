const entries = [
    'public/js/src/enketo-webform.js',
    'public/js/src/enketo-webform-edit.js',
    'public/js/src/enketo-webform-view.js',
    'public/js/src/enketo-offline-fallback.js'
];
const bundles = entries.map( file => file.replace( '/src/', '/build/' ).replace( '.js', '-bundle.js' ) );

module.exports = {
    entries,
    bundles
};
