const fs = require( 'fs' );
const { createInstrumenter } = require( 'istanbul-lib-instrument' );

/**
 * @typedef {import('istanbul-lib-instrument').InstrumenterOptions} InstrumenterOptions
 */

/**
 * @typedef {import('source-map').RawSourceMap} RawSourceMap
 */

 const instrumenter = createInstrumenter( {
    compact: false,
    esModules: true,
} );

/**
 * @param {string} source
 * @param {string} path
 * @param {RawSourceMap} [inputSourceMap]
 * @return {Promise<string>}
 */
const instrument = ( source, path, inputSourceMap ) => (
    new Promise( ( resolve, reject ) => {
        instrumenter.instrument( source, path, ( error, code ) => {
            if ( error == null ) {
                resolve( code );
            } else {
                reject( error );
            }
        }, inputSourceMap );
    } )
);

/**
 * @return {import('esbuild').Plugin}
 */
const esbuildPluginIstanbul = () => ( {
    name: 'istanbul',
    setup( build ) {
        build.onLoad( {
            filter: /\/public\/js\/src\//,
        }, async ( { path } ) => {
            const contents = String( fs.readFileSync( path ) );

            if ( !path.includes( '/public/js/src/' ) ) {
                return { contents };
            }

            const instrumented = await instrument( contents, path );

            return { contents: instrumented };
        } );
    },
} );

module.exports = esbuildPluginIstanbul;
