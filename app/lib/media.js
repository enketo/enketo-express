/* eslint-disable max-classes-per-file */

const transformer = require('enketo-transformer');
const path = require('path').posix;
const cacheModel = require('../models/cache-model');
const instanceModel = require('../models/instance-model');
const surveyModel = require('../models/survey-model');
const userModel = require('../models/user-model');
const communicator = require('./communicator');

/** @enum {'0' | '1'} */
const ResourceType = /** @type {const} */ ({
    MANIFEST: '0',
    INSTANCE: '1',
});

/**
 * @typedef MediaURLSegments
 * @property {string} resourceType
 * @property {string} resourceId
 * @property {string} fileName
 */

/**
 * @param {string} requestPath
 * @return {MediaURLSegments | void}
 */
const matchMediaURLSegments = (requestPath) => {
    // Note: express `request.url` begins with the path attached to the
    // *route*, rather than the full request path.
    const matches = requestPath.match(
        /^\/get\/([01])\/([^/]+)(?:\/([^/]+))?\/(.+$)/
    );

    if (matches != null) {
        const [, resourceType, resourceId, hash, fileName] = matches;

        return {
            resourceType,
            resourceId,
            fileName,
            hash,
        };
    }
};

/**
 * @typedef MediaURLOptions
 * @property {string} basePath
 * @property {string} fileName
 * @property {string} resourceType
 * @property {string} resourceId
 */

/**
 * @param {MediaURLOptions} options
 */
const createMediaURL = (options) => {
    const { basePath, fileName, hash, resourceType, resourceId } = options;

    const mediaPath = path
        .join(
            '/',
            basePath,
            'media',
            'get',
            resourceType,
            resourceId,
            hash?.replace('md5:', '') ?? '',
            fileName
        )
        .replace('//', '');

    return transformer.escapeURLPath(mediaPath);
};

const markupEntities = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
};

/**
 * @param {string} fileName
 */
const escapeFileName = (fileName) =>
    transformer
        .escapeURLPath(fileName)
        .replace(/[\\/]/g, (character) => encodeURIComponent(character))
        .replace(/[&<>"]/g, (character) => markupEntities[character]);

/**
 * @param {string} url
 */
const escapeURL = (url) => {
    const isFullyQualified = /^[a-z]+:/.test(url);

    if (isFullyQualified) {
        const { href } = new URL(url);

        return href;
    }

    return transformer.escapeURLPath(url);
};

/**
 * @typedef {import('../models/survey-model').ManifestItem} ManifestItem
 */

/**
 * @param {string}
 * @param {ManifestItem[] | Record<string, string>} media
 * @param {HostURLOptions} options
 */
const getMediaMap = async (resourceId, media, options) => {
    const { basePath } = options;
    const resourceType = Array.isArray(media)
        ? ResourceType.MANIFEST
        : ResourceType.INSTANCE;
    const mediaEntries =
        resourceType === ResourceType.MANIFEST
            ? media
            : Object.entries(media).map(([filename, downloadUrl]) => ({
                  filename,
                  downloadUrl,
              }));

    /** @type {Record<string, string>} */
    const result = {};

    await Promise.all(
        mediaEntries.map(({ filename, hash, downloadUrl }) => {
            const mediaURL = createMediaURL({
                basePath,
                fileName: filename,
                hash,
                resourceType,
                resourceId,
            });

            /**
             * For future reference: special URL characters are escaped in jr: URLs
             * by enketo-transformer. Those URLs are then replaced with actual media
             * URLs by enketo-express (see `replaceMediaSources` in
             * /public/js/src/module/media.js), by matching the file name portion of
             * each URL to the keys in this media mapping. We perform the same
             * escaping logic here to ensure keys match file names when they have
             * special URL characters.
             */
            result[escapeFileName(filename)] = mediaURL;

            if (resourceType === ResourceType.MANIFEST) {
                return cacheModel.cacheManifestItem(
                    mediaURL,
                    escapeURL(downloadUrl)
                );
            }
        })
    );

    return result;
};

/**
 * @typedef {import('../models/survey-model').SurveyObject} Survey
 */

/**
 * A simplified version of the minimal logic performed in
 * transformation-controller.js, for cached forms. Currently redundantly
 * reimplemented, because:
 *
 * - transformation-controller doesn't and currently _can't_ export it
 * - this omits some logic which is performed when caching forms, but
 *   it's intended purpose is to support retrieving a manifest for an
 *   already-cached form.
 *
 * In the future we can investigate whether this logic can be reused
 * there, eliminating the redundancy.
 *
 * @param {string} enketoId
 * @param {HostURLOptions} options
 * @return {Promise<Survey>}
 */
const getSurveyInfo = async (enketoId, options) => {
    const { auth: credentials, cookie } = options;
    const { openRosaServer, openRosaId } = await surveyModel.get(enketoId);

    return communicator.getXFormInfo({
        openRosaServer,
        openRosaId,
        cookie,
        credentials,
    });
};

/**
 * @param {string} enketoId
 * @param {HostURLOptions} options
 * @return {Promise<Survey>}
 */
const getManifest = async (enketoId, options) => {
    const surveyInfo = await getSurveyInfo(enketoId, options);
    const { manifest } = await communicator.getManifest(surveyInfo);

    return manifest;
};

const getInstanceAttachments = async (instanceId) => {
    const { instanceAttachments } = await instanceModel.get({ instanceId });

    return Object.fromEntries(
        Object.entries(instanceAttachments).map(([key, value]) => [
            escapeFileName(key),
            escapeURL(value),
        ])
    );
};

/** @type {Map<string, Promise<Record<string, string> | ManifestItem[]>>} */
const rebuildMediaURLCachePromises = new Map();

/**
 * @param {ResourceType} resourceType
 * @param {string} resourceId
 * @param {HostURLOptions} options
 */
const rebuildMediaURLCache = async (resourceType, resourceId, options) => {
    const promiseKey = `${resourceType}:${resourceId}:${options.mediaHash}`;

    let promise = rebuildMediaURLCachePromises.get(promiseKey);

    if (promise != null) {
        return promise;
    }

    if (resourceType === ResourceType.MANIFEST) {
        promise = getManifest(resourceId, options);
    } else {
        promise = getInstanceAttachments(resourceId);
    }

    rebuildMediaURLCachePromises.set(promiseKey, promise);

    const media = await promise;

    setTimeout(() => {
        rebuildMediaURLCachePromises.delete(promiseKey);
    });

    getMediaMap(resourceId, media, options);
};

/**
 * @typedef HostURLOptions
 * @property {string} [auth]
 * @property {string} basePath
 * @property {string} [cookie]
 * @property {string} [mediaHash]
 * @property {string} requestPath
 */

/**
 * @param {import('express').Request} request
 * @param {string} [mediaHash]
 * @return {HostURLOptions}
 */
const getHostURLOptions = (request, mediaHash) => ({
    auth: userModel.getCredentials(request),
    basePath: request.app.get('base path') ?? '',
    cookie: request.headers.cookie,
    mediaHash,
    requestPath: request.url,
});

/**
 * @param {HostURLOptions} options
 */
const getHostURL = async (options) => {
    const { basePath, requestPath } = options;
    const mediaURLSegments = matchMediaURLSegments(requestPath);

    if (mediaURLSegments == null) {
        return;
    }

    const { fileName, resourceId, resourceType } = mediaURLSegments;

    if (resourceType === ResourceType.INSTANCE) {
        const instanceAttachments = await getInstanceAttachments(resourceId);

        return instanceAttachments[fileName];
    }

    const mediaURL = createMediaURL({
        ...mediaURLSegments,
        basePath,
    });

    let hostURL = await cacheModel.getManifestItem(mediaURL);

    if (hostURL == null) {
        await rebuildMediaURLCache(resourceType, resourceId, options);

        hostURL = await cacheModel.getManifestItem(mediaURL);
    }

    return hostURL ?? null;
};

module.exports = {
    getMediaMap,
    getHostURLOptions,
    getHostURL,
};
