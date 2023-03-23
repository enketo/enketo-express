const request = require('request');
const configModel = require('../../models/config-model');

function getGoogleResponse(query, callback) {
    query = query || {};
    const config = configModel.server.geocoder || {};
    const url =
        config.url || 'https://maps.googleapis.com/maps/api/geocode/json';

    const accessToken =
        config['api key'] || configModel.server.google['api key'];

    const params = {
        ...config.params,
        key: accessToken,
        // proximity: query.$center, // -93.17284130807734,45.070291367515466
        // bbox: query.$bbox, // -93.13644718051957,45.05118347242032,-93.17284130807734,45.070291367515466
        // limit: query.$limit,
        address: query.address,
    };

    return request(
        url,
        {
            qs: params,
        },
        (error, response, body) => {
            let data;
            try {
                data = JSON.parse(body);
            } catch (e) {
                data = {
                    features: [],
                };
            }
            data = data.results
                ? data.results.map((f) => ({
                      geometry: {
                          type: 'Point',
                          coordinates: [
                              f.geometry.location.lon,
                              f.geometry.location.lat,
                          ], // [125.6, 10.1],
                      },
                      id: f.place_id,
                      type: 'Feature',
                      properties: {
                          name: f.formatted_address,
                          type: f.geometry.location_type,
                          //   score: f.relevance,
                          //   accuracy: f.properties.accuracy,
                      },
                  }))
                : { error: data.message, status: data.status };
            callback(data);
        }
    );
}

module.exports = getGoogleResponse;
