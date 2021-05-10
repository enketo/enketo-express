/**
 * @module pdf
 */
const config = require( '../models/config-model' ).server;
const timeout = config.headless.timeout;
const puppeteer = require( 'puppeteer' );
const { URL } = require( 'url' );

/**
 * @typedef PdfGetOptions
 * @property { string } [format]
 * @property { string } [margin]
 * @property { string } [landscape]
 * @property { string } [scale]
 */

/**
 * default values for {@link module:pdf~PdfGetOptions|PdfGetOptions}
 *
 * @default
 */
const DEFAULTS = {
    FORMAT: 'A4',
    MARGIN: '0.5in',
    LANDSCAPE: false,
    SCALE: 1
};

/**
 * Asynchronously gets pdf from url using Puppeteer.
 *
 * @static
 * @param { string } url - URL to load
 * @param {PdfGetOptions} [options] - PDF options
 * @return { Promise } a promise that returns the PDF
 */
async function get( url, options = {} ) {
    if ( !url ) {
        throw new Error( 'No url provided' );
    }

    options.format = options.format || DEFAULTS.FORMAT;
    options.margin = options.margin || DEFAULTS.MARGIN;
    options.landscape = options.landscape || DEFAULTS.LANDSCAPE;
    options.scale = options.scale || DEFAULTS.SCALE;

    const urlObj = new URL( url );
    urlObj.searchParams.append( 'format', options.format );
    urlObj.searchParams.append( 'margin', options.margin );
    urlObj.searchParams.append( 'landscape', options.landscape );
    urlObj.searchParams.append( 'scale', options.scale );

    const browser = await puppeteer.launch( { headless: true } );
    const page = await browser.newPage();

    let pdf;

    try {
        await page.goto( urlObj.href, { waitUntil: 'networkidle0', timeout } )
            .catch( e => {
                e.status = /timeout/i.test( e.message ) ? 408 : 400;
                throw e;
            } );

        pdf = await page.pdf( {
            landscape: options.landscape,
            format: options.format,
            margin: {
                top: options.margin,
                left: options.margin,
                right: options.margin,
                bottom: options.margin
            },
            scale: options.scale,
            printBackground: true
        } );
    } catch ( e ) {
        e.status = e.status || 400;
        await page.close();
        throw e;
    }

    await page.close();
    await browser.close();

    return pdf;
}

module.exports = { get };
