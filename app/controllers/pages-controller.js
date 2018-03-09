const express = require( 'express' );
const router = express.Router();
// var debug = require( 'debug' )( 'pages-controller' );

module.exports = app => {
    app.use( `${app.get( 'base path' )}/`, router );
};

router
    .get( '/', ( req, res ) => {
        res.render( 'index', {
            openrosa: req.app.get( 'linked form and data server' ).name || '?',
            languages: req.app.get( 'languages supported' ),
            version: req.app.get( 'version' )
        } );
    } )
    .get( '/modern-browsers', ( req, res ) => {
        res.render( 'pages/modern-browsers', {
            title: 'Modern Browsers'
        } );
    } )
    .get( '/offline', ( req, res ) => {
        res.render( 'pages/offline', {
            title: 'Offline'
        } );
    } )
    .get( '/thanks', ( req, res ) => {
        res.render( 'surveys/thanks', {
            title: 'Thanks',
            taken: req.query.taken
        } );
    } );
