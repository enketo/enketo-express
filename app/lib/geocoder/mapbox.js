const configModel = require( '../../models/config-model' );
const request = require( 'request' );

module.exports = function getMapboxResponse( query, callback ) {

    const config = configModel.server.geocoder;
    let url = config.url || 'https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json';
    const accessToken = config.apiKey;

    const params = Object.assign( {}, config.params, {
        access_token: accessToken,
        proximity: query.$center, // -93.17284130807734,45.070291367515466
        bbox: query.$bbox, // -93.13644718051957,45.05118347242032,-93.17284130807734,45.070291367515466
    } );

    return request( url.replace( '{address}', query.address ),
        {
            qs: params
        },
        ( error, response, body ) => {
            let data;
            try {
                data = JSON.parse( body );
            } catch( e ) {
                data = {
                    features: [],
                };
            }
            callback(
                data.features.map( f => {
                    return {
                        geometry: f.geometry,
                        id: f.id,
                        type: f.type,
                        properties: {
                            name: f.place_name,
                            type: f.place_type.join( ',' ),
                            score: f.relevance,
                            accuracy: f.properties.accuracy,
                        }
                    };
                } )
            );
        }
    );
};
