const config = require( '../models/config-model' );
const express = require( 'express' );
const router = express.Router();
// var debug = require( 'debug' )( 'config-controller' );

module.exports = app => {
    app.use( `${config.server[ 'base path' ]}/client-config.json`, router );
};

router
    .get( '/', ( req, res ) => {
        res.json( config.client );
    } );
