const express = require('express');
const configModel = require('../models/config-model');
const getMapboxResponse = require('../lib/geocoder/mapbox');
const getGoogleResponse = require('../lib/geocoder/google');

function getGeocodeResponse(req, res) {
    const provider = configModel.server.geocoder?.provider || 'google';
    const geocoders = {
        google: getGoogleResponse,
        mapbox: getMapboxResponse,
    };
    const geocoder = geocoders[provider];
    if (!geocoder) {
        throw new Error(
            'Geocoder provider is not configured. Please configure `config.geocoder.provider`'
        );
    }
    geocoder(req.query, (response) => res.status(200).json(response));
}

const router = express.Router();

router.get('/geocoder', getGeocodeResponse);

module.exports = function (app) {
    app.use('/api/geo', router);
};
