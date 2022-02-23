import fileManager from '../../public/js/src/module/file-manager';
import settings from '../../public/js/src/module/settings';
import store from '../../public/js/src/module/store';

describe('File manager', () => {
    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('getting file URLs', () => {
        it('gets an absolute path', async () => {
            const result = await fileManager.getFileUrl('/absolute.png');

            expect(result).to.equal('/absolute.png');
        });

        describe('instance attachments', () => {
            afterEach(() => {
                fileManager.setInstanceAttachments(null);
            });

            it('gets a URL from instance attachments by filename', async () => {
                fileManager.setInstanceAttachments({
                    'relative.png': 'https://example.com/path/to/relative.png',
                });

                const result = await fileManager.getFileUrl('relative.png');

                expect(result).to.equal(
                    'https://example.com/path/to/relative.png'
                );
            });

            it('gets a URL from instance attachments by filename with a space', async () => {
                fileManager.setInstanceAttachments({
                    'space madness.png':
                        'https://example.com/path/to/space%20madness.png',
                });

                const result = await fileManager.getFileUrl(
                    'space madness.png'
                );

                expect(result).to.equal(
                    'https://example.com/path/to/space%20madness.png'
                );
            });

            it('gets a URL from instance attachments by filename with an escaped space', async () => {
                fileManager.setInstanceAttachments({
                    'space%20madness.png':
                        'https://example.com/path/to/space%20madness.png',
                });

                const result = await fileManager.getFileUrl(
                    'space madness.png'
                );

                expect(result).to.equal(
                    'https://example.com/path/to/space%20madness.png'
                );
            });

            it('gets a URL from instance attachments by escaped filename with an escaped space', async () => {
                fileManager.setInstanceAttachments({
                    'space%20madness.png':
                        'https://example.com/path/to/space%20madness.png',
                });

                const result = await fileManager.getFileUrl(
                    'space%20madness.png'
                );

                expect(result).to.equal(
                    'https://example.com/path/to/space%20madness.png'
                );
            });
        });

        describe('cached resources', () => {
            const enketoId = 'survey a';
            const recordId = 'record 1';

            /** @type {boolean} */
            let isOffline;

            /** @type {boolean} */
            let isStoreAvailable;

            /** @type {number} */
            let maxSize;

            beforeEach(async () => {
                isOffline = true;

                sandbox.stub(settings, 'offline').get(() => isOffline);

                sandbox.stub(settings, 'enketoId').get(() => enketoId);

                if (
                    !Object.prototype.hasOwnProperty.call(settings, 'recordId')
                ) {
                    settings.recordId = undefined;
                }

                sandbox.stub(settings, 'recordId').get(() => recordId);

                isStoreAvailable = true;

                sandbox.stub(store, 'available').get(() => isStoreAvailable);

                maxSize = Number.MAX_SAFE_INTEGER;

                sandbox.stub(settings, 'maxSize').get(() => maxSize);

                await store.init();
            });

            it('gets a blob URL from a cached resource URL', async () => {
                const fileContents = 'file contents';
                const url = 'https://example.com/the%20blob.png';
                const resource = {
                    item: new Blob([fileContents]),
                    url,
                };

                await store.survey.resource.update(enketoId, resource);

                const blobURL = await fileManager.getFileUrl(url);

                expect(blobURL).to.match(/^blob:/);

                const response = await fetch(blobURL);
                const blobResult = await response.blob();

                expect(blobResult).to.be.an.instanceof(Blob);

                const data = await blobResult.text();

                expect(data).to.equal(fileContents);
            });

            it('fails if the cache store is not available', async () => {
                const resourceGetStub = sandbox.stub(
                    store.survey.resource,
                    'get'
                );

                /** @type {Error} */
                let caught;

                isStoreAvailable = false;

                try {
                    await fileManager.getFileUrl(
                        'https://example.com/anything.png'
                    );
                } catch (error) {
                    caught = error;
                }

                expect(caught).to.be.an.instanceof(Error);
                expect(resourceGetStub).not.to.have.been.called;
            });

            it('fails if the resource URL is not cached', async () => {
                const resourceURL = 'https://example.com/anything.png';

                /** @type {Error} */
                let caught;

                try {
                    await fileManager.getFileUrl(resourceURL);
                } catch (error) {
                    caught = error;
                }

                expect(caught).to.be.an.instanceof(Error);
            });

            it('gets a blob URL from a cached file upload', async () => {
                const fileContents = 'file contents';
                const name = 'the blob.png';
                const resource = {
                    item: new Blob([fileContents]),
                    name,
                };

                await store.record.file.update(recordId, resource);

                const blobURL = await fileManager.getFileUrl(name);

                expect(blobURL).to.match(/^blob:/);

                const response = await fetch(blobURL);
                const blobResult = await response.blob();

                expect(blobResult).to.be.an.instanceof(Blob);

                const data = await blobResult.text();

                expect(data).to.equal(fileContents);
            });

            it('fails if not in offline-capable mode, if the store is available and the resource is cached', async () => {
                const fileContents = 'file contents';
                const name = 'the blob.png';
                const resource = {
                    item: new Blob([fileContents]),
                    name,
                };

                await store.record.file.update(recordId, resource);

                const resourceGetStub = sandbox.stub(
                    store.survey.resource,
                    'get'
                );

                /** @type {Error} */
                let caught;

                isOffline = false;

                try {
                    await fileManager.getFileUrl(name);
                } catch (error) {
                    caught = error;
                }

                expect(caught).to.be.an.instanceof(Error);
                expect(resourceGetStub).not.to.have.been.called;
            });

            it('fails if the file is not cached', async () => {
                const fileName = 'anything.png';

                /** @type {Error} */
                let caught;

                try {
                    await fileManager.getFileUrl(fileName);
                } catch (error) {
                    caught = error;
                }

                expect(caught).to.be.an.instanceof(Error);
            });

            it('fails if the cached file is too large', async () => {
                /** @type {Error} */
                let caught;

                const fileContents = 'file contents';
                const name = 'the blob.png';
                const resource = {
                    item: new Blob([fileContents]),
                    name,
                };

                maxSize = resource.item.size - 1;

                await store.record.file.update(recordId, resource);

                try {
                    await fileManager.getFileUrl(name);
                } catch (error) {
                    caught = error;
                }

                expect(caught).to.be.an.instanceof(Error);
            });

            it('gets a blob URL from a Blob object', async () => {
                const fileContents = 'file contents';
                const blob = new Blob([fileContents]);

                const blobURL = await fileManager.getFileUrl(blob);

                expect(blobURL).to.match(/^blob:/);

                const response = await fetch(blobURL);
                const blobResult = await response.blob();

                expect(blobResult).to.be.an.instanceof(Blob);

                const data = await blobResult.text();

                expect(data).to.equal(fileContents);
            });

            it('fails if a Blob object is too large', async () => {
                /** @type {Error} */
                let caught;

                const fileContents = 'file contents';
                const blob = new Blob([fileContents]);

                maxSize = blob.size - 1;

                try {
                    await fileManager.getFileUrl(blob);
                } catch (error) {
                    caught = error;
                }

                expect(caught).to.be.an.instanceof(Error);
            });
        });
    });
});
