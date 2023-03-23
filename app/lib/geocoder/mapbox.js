const request = require('request');
const configModel = require('../../models/config-model');

module.exports = function getMapboxResponse(query, callback) {
    const config = configModel.server.geocoder || {};
    const url =
        config.url ||
        'https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json';
    const accessToken = config['api key'];

    const params = {
        ...config.params,
        access_token: accessToken,
        proximity: query.$center, // -93.17284130807734,45.070291367515466
        bbox: query.$bbox, // -93.13644718051957,45.05118347242032,-93.17284130807734,45.070291367515466
        limit: query.$limit,
    };

    return request(
        url.replace('{address}', query.address),
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
            data = data.features
                ? data.features.map((f) => ({
                      geometry: f.geometry,
                      id: f.id,
                      type: f.type,
                      properties: {
                          name: f.place_name,
                          type: f.place_type.join(','),
                          score: f.relevance,
                          accuracy: f.properties.accuracy,
                      },
                  }))
                : { error: data.message };
            callback(data);
        }
    );
};
