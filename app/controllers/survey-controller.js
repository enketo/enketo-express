const utils = require( '../lib/utils' );
const TError = require( '../lib/custom-error' ).TranslatedError;
const communicator = require( '../lib/communicator' );
const surveyModel = require( '../models/survey-model' );
const userModel = require( '../models/user-model' );
const config = require( '../models/config-model' ).server;
const express = require( 'express' );
const router = express.Router();
const routerUtils = require( '../lib/router-utils' );
// var debug = require( 'debug' )( 'survey-controller' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/`, router );
};

router.param( 'enketo_id', routerUtils.enketoId );
router.param( 'encrypted_enketo_id_single', routerUtils.encryptedEnketoIdSingle );
router.param( 'encrypted_enketo_id_view', routerUtils.encryptedEnketoIdView );

router.param( 'mod', ( req, rex, next, mod ) => {
    if ( mod === 'i' ) {
        req.iframe = true;
        next();
    } else {
        req.iframe = false;
        next( 'route' );
    }
} );

router
    //.get( '*', loggedInCheck )
    .get( '/x/', offlineWebform )
    .get( '/_/', offlineWebform )
    .get( '/:enketo_id', webform )
    .get( '/:mod/:enketo_id', webform )
    .get( '/preview/:enketo_id', preview )
    .get( '/preview/:mod/:enketo_id', preview )
    .get( '/preview', preview )
    .get( '/preview/:mod', preview )
    .get( '/single/:enketo_id', single )
    .get( '/single/:encrypted_enketo_id_single', single )
    .get( '/single/:mod/:enketo_id', single )
    .get( '/single/:mod/:encrypted_enketo_id_single', single )
    .get( '/view/:encrypted_enketo_id_view', view )
    .get( '/view/:mod/:encrypted_enketo_id_view', view )
    .get( '/edit/:enketo_id', edit )
    .get( '/edit/:mod/:enketo_id', edit )
    .get( '/xform/:enketo_id', xform )
    .get( '/xform/:encrypted_enketo_id_single', xform )
    .get( '/xform/:encrypted_enketo_id_view', xform )
    .get( '/connection', ( req, res ) => {
        res.status = 200;
        res.send( `connected ${Math.random()}` );
    } );

// TODO: I suspect this check is no longer used and can be removed
//function loggedInCheck( req, res, next ) {
//    req.logout = !!userModel.getCredentials( req );
//    next();
//}

function offlineWebform( req, res, next ) {
    if ( !req.app.get( 'offline enabled' ) ) {
        const error = new Error( 'Offline functionality has not been enabled for this application.' );
        error.status = 405;
        next( error );
    } else {
        req.manifest = `${req.app.get( 'base path' )}/x/manifest.appcache`;
        webform( req, res, next );
    }
}

function webform( req, res, next ) {
    const options = {
        manifest: req.manifest,
        iframe: req.iframe,
        print: req.query.print === 'true'
    };

    _renderWebform( req, res, next, options );
}

function single( req, res, next ) {
    const options = {
        type: 'single',
        iframe: req.iframe
    };
    if ( req.encryptedEnketoId && req.cookies[ req.encryptedEnketoId ] ) {
        res.redirect( `/thanks?taken=${req.cookies[ req.encryptedEnketoId ]}` );
    } else {
        _renderWebform( req, res, next, options );
    }
}

function view( req, res, next ) {
    const options = {
        type: 'view',
        iframe: req.iframe,
        print: req.query.print === 'true'
    };

    _renderWebform( req, res, next, options );
}

function preview( req, res, next ) {
    const options = {
        type: 'preview',
        iframe: req.iframe || !!req.query.iframe,
        notification: utils.pickRandomItemFromArray( config.notifications )
    };

    _renderWebform( req, res, next, options );
}

function edit( req, res, next ) {
    const options = {
        type: 'edit',
        iframe: req.iframe,
    };

    if ( req.query.instance_id ) {
        _renderWebform( req, res, next, options );
    } else {
        const error = new TError( 'error.invalidediturl' );
        error.status = 400;
        next( error );
    }
}

function _renderWebform( req, res, next, options ) {
    const deviceId = req.signedCookies[ '__enketo_meta_deviceid' ] || `${req.hostname}:${utils.randomString( 16 )}`,
        cookieOptions = {
            signed: true,
            maxAge: 10 * 365 * 24 * 60 * 60 * 1000
        };

    res
        .cookie( '__enketo_meta_deviceid', deviceId, cookieOptions )
        .render( 'surveys/webform', options );
}

/**
 * Debugging view that shows underlying XForm
 * @param  {[type]}   req  [description]
 * @param  {[type]}   res  [description]
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
function xform( req, res, next ) {
    return surveyModel.get( req.enketoId )
        .then( survey => {
            survey.credentials = userModel.getCredentials( req );
            return survey;
        } )
        .then( communicator.getXFormInfo )
        .then( communicator.getXForm )
        .then( survey => {
            res
                .set( 'Content-Type', 'text/xml' )
                .send( survey.xform );
        } )
        .catch( next );
}
