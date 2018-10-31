import sniffer from './sniffer';
const trident = sniffer.browser.ie;

if ( trident ) {
    window.location.href = '/modern-browsers';
}
