const utils = require( '../lib/utils' );
const config = require( './config-model' ).server;
const customGetAccount = config[ 'account lib' ] ? require( config[ 'account lib' ] ).getAccount : undefined;
// var debug = require( 'debug' )( 'account-model' );

/**
 * Obtain account
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function get( survey ) {
    let error;
    const server = _getServer( survey );

    if ( !server ) {
        error = new Error( 'Bad Request. Server URL missing.' );
        error.status = 400;
        return Promise.reject( error );
    } else if ( !utils.isValidUrl( server ) ) {
        error = new Error( 'Bad Request. Server URL is not a valid URL.' );
        error.status = 400;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/bob/.test( server ) ) {
        return Promise.resolve( {
            linkedServer: server,
            key: 'abc',
            quota: 100
        } );
    } else if ( /https?:\/\/testserver.com\/noquota/.test( server ) ) {
        error = new Error( 'Forbidden. No quota left.' );
        error.status = 403;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/noapi/.test( server ) ) {
        error = new Error( 'Forbidden. No API access granted.' );
        error.status = 405;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/noquotanoapi/.test( server ) ) {
        error = new Error( 'Forbidden. No API access granted.' );
        error.status = 405;
        return Promise.reject( error );
    } else if ( /https?:\/\/testserver.com\/notpaid/.test( server ) ) {
        error = new Error( 'Forbidden. The account is not active.' );
        error.status = 403;
        return Promise.reject( error );
    }

    return _getAccount( server );
}

/** 
 * Check if account for passed survey is active, and not exceeding quota.
 * This passes back the original survey object and therefore differs from the get function!
 * 
 * @param  {[type]} survey [description]
 * @return {[type]}        [description]
 */
function check( survey ) {
    return get( survey )
        .then( account => {
            survey.account = account;
            return survey;
        } );
}

/**
 * Checks if the provided serverUrl is part of the allowed 'linked' OpenRosa Server
 * @param { {openRosaServer:string, key:string}} account object
 * @param { string} serverUrl
 * @return { boolean } [description]
 */
function _isAllowed( account, serverUrl ) {
    return account.linkedServer === '' || new RegExp( `https?://${_stripProtocol( account.linkedServer )}` ).test( serverUrl );
}

/**
 * Strips http(s):// from the provided url
 * @return {[type]} stripped url
 */
function _stripProtocol( url ) {
    if ( !url ) {
        return null;
    }

    // strip http(s):// 
    if ( /https?:\/\//.test( url ) ) {
        url = url.substring( url.indexOf( '://' ) + 3 );
    }
    return url;
}

/**
 * Obtains account from either configuration (hardcoded) or via custom function
 * 
 * @param  {string} serverUrl the serverUrl to be used to look up the account
 * @return {{openRosaServer: string, key: string, quota: number}} account object
 */
function _getAccount( serverUrl ) {
    const hardcodedAccount = _getHardcodedAccount();

    if ( _isAllowed( hardcodedAccount, serverUrl ) ) {
        return Promise.resolve( hardcodedAccount );
    }

    if ( customGetAccount ) {
        return customGetAccount( serverUrl, config[ 'account api url' ] );
    }

    const error = new Error( 'Forbidden. This server is not linked with Enketo.' );
    error.status = 403;
    return Promise.reject( error );
}

/**
 * Obtains the hardcoded account from the config
 * @return {[type]} [description]
 */
function _getHardcodedAccount() {
    const app = require( '../../config/express' );
    const linkedServer = app.get( 'linked form and data server' );

    // check if configuration is acceptable
    if ( !linkedServer || typeof linkedServer[ 'server url' ] === 'undefined' || typeof linkedServer[ 'api key' ] === 'undefined' ) {
        return null;
    }

    // do not add default branding
    return {
        linkedServer: linkedServer[ 'server url' ],
        key: linkedServer[ 'api key' ],
        quota: linkedServer[ 'quota' ] || Infinity
    };
}

/**
 * Extracts the server from a survey object or server string
 * @param  {string|{openRosaServer:string}} survey server string or survey object
 * @return {[type]}        [description]
 */
function _getServer( survey ) {
    if ( !survey || ( typeof survey === 'object' && !survey.openRosaServer ) ) {
        return null;
    }
    return ( typeof survey === 'string' ) ? survey : survey.openRosaServer;
}

module.exports = {
    get,
    check
};
