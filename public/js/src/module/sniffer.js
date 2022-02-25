import { os } from 'enketo-core/src/js/sniffer';

const ua = navigator.userAgent;

export default {
    browser: {
        get chrome() {
            const matchedChrome = /chrome|crios\/(\d+)/i.test(ua);
            const matchedEdge = /edge\//i.test(ua);

            // MS Edge pretends to be Chrome 42:
            // https://msdn.microsoft.com/en-us/library/hh869301%28v=vs.85%29.aspx
            return !matchedEdge && matchedChrome;
        },
        get safari() {
            return /^((?!chrome|android|fxios|crios|ucbrowser).)*safari/i.test(
                ua
            );
        },
        get firefox() {
            return /firefox|fxios/i.test(ua);
        },
    },
    os,
};
