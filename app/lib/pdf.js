const puppeteer = require( 'puppeteer' );
const { URL } = require( 'url' );
const FORMAT = 'A4';
const MARGIN = '0.5in';
const LANDSCAPE = false;
const SCALE = 1;

/*async*/
function get( url, options = {} ) {
    if ( !url ) {
        throw new Error( 'No url provided' );
    }

    options.format = options.format || FORMAT;
    options.margin = options.margin || MARGIN;
    options.landscape = options.landscape || LANDSCAPE;
    options.scale = options.scale || SCALE;

    const urlObj = new URL( url );
    urlObj.searchParams.append( 'format', options.format );
    urlObj.searchParams.append( 'margin', options.margin );
    urlObj.searchParams.append( 'landscape', options.landscape );
    urlObj.searchParams.append( 'scale', options.scale );

    //const browser = await puppeteer.launch( { headless: true } );
    //const page = await browser.newPage();
    //await page.goto( urlObj.href, { waitUntil: 'networkidle0' } );
    //await page.waitForFunction( 'window.printReady === true', { polling: 200 } );
    let browser;
    let page;
    return puppeteer.launch( { headless: true } )
        .then( brows => {
            browser = brows;
            return browser.newPage();
        } )
        .then( pg => {
            page = pg;
            return page.goto( urlObj.href, { waitUntil: 'networkidle0' } );
        } )
        .then( () => {
            return page.pdf( {
                landscape: options.landscape,
                format: options.format,
                margin: {
                    top: options.margin,
                    left: options.margin,
                    right: options.margin,
                    bottom: options.margin
                },
                scale: options.scale
            } );
        } )
        .then( pdf => {
            browser.close(); // don't wait?
            return pdf;
        } );
    //await pdf;
    //await browser.close();
    //return pdf;
}

module.exports = { get };
