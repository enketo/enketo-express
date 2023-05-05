// @ts-check

const FEATURE = 'Feature';

const POINT = 'Point';
const LINE_STRING = 'LineString';
const POLYGON = 'Polygon';

const SUPPORTED_TYPES = new Set([POINT, LINE_STRING, POLYGON]);
const SUPPORTED_TYPES_MESSAGE =
    'Only Points, LineStrings and Polygons are currently supported';

/**
 * @typedef {import('geojson')} GeoJSON
 */

/**
 * @typedef {GeoJSON.Geometry} Geometry
 */

/**
 * @typedef {GeoJSON.Point & { coordinates: LongLatCoordinates }} Point
 */

/**
 * @typedef {GeoJSON.LineString & { coordinates: LongLatCoordinates[] }} LineString
 */

/**
 * @typedef {GeoJSON.Polygon & { coordinates: [] | [LongLatCoordinates[]] }} Polygon
 */

/**
 * @typedef {Point | LineString | Polygon} SupportedGeometry
 */

/**
 * @typedef {Pick<SupportedGeometry, 'type'> & { coordinates: unknown[] }} BaseSupportedGeometry
 */

/**
 * @typedef {GeoJSON.GeoJsonProperties} GeoJsonProperties
 */

/**
 * @template {Geometry} G
 * @template [P=GeoJsonProperties]
 * @typedef {GeoJSON.Feature<G, P>} Feature
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
 * @param {LongLatCoordinates} coordinates
 */
const coordinatesToString = (coordinates) => {
    const [longitude, latitude] = coordinates;

    return `${latitude} ${longitude} 0 0`;
};

/**
 * @param {XMLDocument} instance
 * @param {SupportedGeometry} geometry
 * @return {Element}
 */
const geometryElement = (instance, geometry) => {
    const element = instance.createElement('geometry');

    /** @type {LongLatCoordinates[]} */
    let points;

    if (geometry.type === POINT) {
        points = [geometry.coordinates];
    } else if (geometry.type === LINE_STRING) {
        points = geometry.coordinates;
    } else {
        points = geometry.coordinates[0];
    }

    element.textContent = points.map(coordinatesToString).join('; ');

    return element;
};

/**
 * @typedef {Omit<Point, 'coordinates'> & { coordinates: LongLatCoordinates }} BaseLongLatPoint
 */

/**
 * @typedef {{ [K in keyof BaseLongLatPoint]: BaseLongLatPoint[K] }} LongLatPoint
 */

/**
 * @param {unknown} data
 * @returns {asserts data is BaseSupportedGeometry}
 */
const validateGeometryType = (data) => {
    if (
        data == null ||
        typeof data !== 'object' ||
        // @ts-expect-error
        !SUPPORTED_TYPES.has(data.type) ||
        // @ts-expect-error
        !Array.isArray(data.coordinates)
    ) {
        throw new TypeError(SUPPORTED_TYPES_MESSAGE);
    }
};

/**
 * @param {unknown} data
 * @return {asserts data is SupportedGeometry}
 */
const validateGeometry = (data) => {
    validateGeometryType(data);

    if (data.type === POINT) {
        validateLongLatCoordinates(data.coordinates);
    } else if (data.type === LINE_STRING) {
        data.coordinates.forEach(validateLongLatCoordinates);
    } else if (Array.isArray(data.coordinates[0])) {
        data.coordinates[0]?.forEach(validateLongLatCoordinates);
    }
};

/**
 * @typedef {import('geojson').Feature<LongLatPoint>} LongLatPointFeature
 */

/**
 * @param {unknown} data
 * @return {asserts data is Feature}
 */
const validateFeature = (data) => {
    if (data == null) {
        throw new TypeError('Feature object expected');
    }

    // @ts-expect-error
    const { geometry, type } = data;

    if (type !== FEATURE || geometry == null) {
        throw new TypeError(
            `Item of type ${type} found but expected item of type ${FEATURE}`
        );
    }

    validateGeometry(geometry);
};

const FEATURE_COLLECTION = 'FeatureCollection';

/**
 * @typedef {import('geojson').FeatureCollection<SupportedGeometry>} SupportedFeatureCollection
 */

/**
 * @param {unknown} data
 * @return {asserts data is SupportedFeatureCollection}
 */
const validateFeatureCollection = (data) => {
    // @ts-expect-error
    const { type, features } = data ?? {};

    if (type !== FEATURE_COLLECTION || !Array.isArray(features)) {
        throw new TypeError('GeoJSON file must be a FeatureCollection');
    }

    features.forEach(validateFeature);
};

const parser = new DOMParser();

/**
 * @param {unknown} data
 */
// eslint-disable-next-line import/prefer-default-export
export const geoJSONExternalInstance = (data) => {
    validateFeatureCollection(data);

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

        item.append(geometryElement(instance, geometry));

        entries.forEach(([key, value]) => {
            const element = instance.createElement(key);

            element.textContent = String(value ?? '');

            item.append(element);
        });

        root.append(item);
    });

    return instance;
};
