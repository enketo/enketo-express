const express = require( 'express' );
const router = express.Router();

module.exports = app => {
    app.use( `${app.get( 'base path' )}/api`, router );
};

router
    .get( '/', ( req, res ) => {
        res.redirect( 'http://apidocs.enketo.org' );
    } );
