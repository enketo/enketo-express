const puppeteer = require('puppeteer');

const args = ['--no-startup-window'];
const userDataDir = './chromium-cache';

/**
 * This class approach makes it easy to open multiple browser instances with
 * different arguments in case that is ever required.
 */
class BrowserHandler {
    constructor() {
        const launchBrowser = async () => {
            this.browser = false;
            this.browser = await puppeteer.launch({
                headless: true,
                devtools: false,
                args,
                userDataDir,
            });
            this.browser.on('disconnected', launchBrowser);
        };

        (async () => {
            await launchBrowser();
        })();
    }
}

const getBrowser = (handler) =>
    new Promise((resolve) => {
        const browserCheck = setInterval(() => {
            if (handler.browser !== false) {
                clearInterval(browserCheck);
                resolve(handler.browser);
            }
        }, 100);
    });

module.exports = { BrowserHandler, getBrowser };
