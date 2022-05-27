const POINT = 'Point';

/**
 * @typedef {import('geojson').Point} Point
 */

/**
 * @typedef {[longitude: number, latitude: number]} LongLatCoordinates
 */

/**
 * @param {unknown} data
 * @return {asserts data is LongLatCoordinates}
 */
const validateLongLatCoordinates = (data) => {
    if (
        !Array.isArray(data) ||
        data.length !== 2 ||
        typeof data[0] !== 'number' ||
        typeof data[1] !== 'number'
    ) {
        throw new TypeError(
            `Only ${POINT}s with latitude and longitude are currently supported`
        );
    }
};

/**
 * @param {XMLDocument} instance
 * @param {LongLatCoordinates} coordinates
 */
const geometryElement = (instance, coordinates) => {
    const [longitude, latitude] = coordinates;
    const element = instance.createElement('geometry');

    element.textContent = `${latitude} ${longitude} 0 0`;

    return element;
};

/**
 * @typedef {Omit<Point, 'coordinates'> & { coordinates: LongLatCoordinates }} BaseLongLatPoint
 */

/**
 * @typedef {{ [K in keyof BaseLongLatPoint]: BaseLongLatPoint[K]} LongLatPoint
 */

/**
 * @param {unknown} data
 * @returns {asserts data is LongLatPoint}
 */
const validateLongLatPoint = (data) => {
    if (data == null || data.type !== POINT) {
        throw new TypeError(`Only ${POINT}s are currently supported`);
    }

    validateLongLatCoordinates(data.coordinates);
};

const FEATURE = 'Feature';

/**
 * @typedef {import('geojson').Feature<LongLatPoint>} LongLatPointFeature
 */

/**
 * @param {unknown} data
 * @return {asserts data is Feature}
 */
const validateLongLatFeature = (data) => {
    if (data == null) {
        throw new TypeError('Feature object expected');
    }

    const { geometry, type } = data;

    if (type !== FEATURE || geometry == null) {
        throw new TypeError(
            `Item of type ${type} found but expected item of type ${FEATURE}`
        );
    }

    validateLongLatPoint(geometry);
};

const FEATURE_COLLECTION = 'FeatureCollection';

/**
 * @typedef {import('geojson').FeatureCollection<LongLatPoint>} LongLatPointFeatureCollection
 */

/**
 * @param {unknown} data
 * @return {asserts data is LongLatPointFeatureCollection}
 */
const validateLongLatFeatureCollection = (data) => {
    if (data?.type !== FEATURE_COLLECTION || !Array.isArray(data.features)) {
        throw new TypeError('GeoJSON file must be a FeatureCollection');
    }

    data.features.forEach(validateLongLatFeature);
};

const parser = new DOMParser();

/**
 * @param {unknown} data
 */
// eslint-disable-next-line import/prefer-default-export
export const geoJSONExternalInstance = (data) => {
    validateLongLatFeatureCollection(data);

    const instance = parser.parseFromString('<root/>', 'text/xml');
    const root = instance.documentElement;

    data.features.forEach(({ id: featureId, geometry, properties }) => {
        const { id: propertiesId, ...restProperties } = properties ?? {};
        const entries = Object.entries(restProperties);

        const id = featureId ?? propertiesId;

        if (id !== undefined) {
            entries.push(['id', id]);
        }

        const item = instance.createElement('item');

        item.append(geometryElement(instance, geometry.coordinates));

        entries.forEach(([key, value]) => {
            const element = instance.createElement(key);

            element.textContent = String(value ?? '');

            item.append(element);
        });

        root.append(item);
    });

    return instance;
};
