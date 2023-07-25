/**
 * @module pdf
 */
const { URL } = require('url');
const config = require('../models/config-model').server;
const { BrowserHandler, getBrowser } = require('./headless-browser');

const browserHandler = new BrowserHandler();
const { timeout } = config.headless;

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
    SCALE: 1,
};

/**
 * Asynchronously gets pdf from url using Puppeteer.
 *
 * @static
 * @param { string } url - URL to load
 * @param {PdfGetOptions} [options] - PDF options
 * @return { Promise } a promise that returns the PDF
 */
async function get(
    url,
    {
        format = DEFAULTS.FORMAT,
        margin = DEFAULTS.MARGIN,
        landscape = DEFAULTS.LANDSCAPE,
        scale = DEFAULTS.SCALE,
    } = {}
) {
    if (!url) {
        throw new Error('No url provided');
    }

    const urlObj = new URL(url);
    urlObj.searchParams.append('format', format);
    urlObj.searchParams.append('margin', margin);
    urlObj.searchParams.append('landscape', landscape);
    urlObj.searchParams.append('scale', scale);

    const browser = await getBrowser(browserHandler);
    const page = await browser.newPage();

    let pdf;

    try {
        // To use an eventhandler here and catch a specific error,
        // we have to return a Promise (in this case one that never resolves).
        const detect401 = new Promise((resolve, reject) => {
            page.on('requestfinished', (request) => {
                if (request.response().status() === 401) {
                    const e = new Error('Authentication required');
                    e.status = 401;
                    reject(e);
                }
            });
        });
        const goToPage = page
            .goto(urlObj.href, { waitUntil: 'networkidle0', timeout })
            .catch((e) => {
                e.status = /timeout/i.test(e.message) ? 408 : 400;
                throw e;
            });

        // Either a 401 error is thrown or goto succeeds (or encounters a real loading error)
        await Promise.race([detect401, goToPage]);

        /*
         * This works around an issue with puppeteer not printing canvas
         * images that were loaded from a file.
         * It is likely this issue: https://bugs.chromium.org/p/chromium/issues/detail?id=809065
         * (though not WebGL-related as some of the commenters suggest)
         */
        await page.evaluate(() => {
            /* eslint-env browser */
            function canvasToImage(element) {
                const image = document.createElement('img');
                image.src = element.toDataURL();

                ['width', 'height', 'position', 'left', 'top'].forEach(
                    (property) =>
                        (image.style[property] = element.style[property])
                );
                // overriding a general image style
                image.style['max-width'] = '100%';
                image.className = element.className;

                element.parentNode &&
                    element.parentNode.insertBefore(image, element);
                element.parentNode && element.parentNode.removeChild(element);
            }

            document.querySelectorAll('canvas').forEach(canvasToImage);
        });

        pdf = await page.pdf({
            landscape,
            format,
            margin: {
                top: margin,
                left: margin,
                right: margin,
                bottom: margin,
            },
            scale,
            printBackground: true,
            timeout,
        });
    } catch (e) {
        e.status = e.status || 400;
        await page.close();
        throw e;
    }

    await page.close();

    return pdf;
}

module.exports = { get };
