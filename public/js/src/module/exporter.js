import JSZip from 'jszip';
import store from './store';
import utils from './utils';

function recordsToZip(enketoId, formTitle) {
    let folder;
    let folderName;
    const failures = [];
    const tasks = [];
    const meta = [];
    const name = formTitle || enketoId;
    const zip = new JSZip();

    return store.record
        .getAll(enketoId)
        .then(
            (
                records // sequentially to be kind to indexedDB
            ) =>
                records.reduce(
                    (prevPromise, record) =>
                        prevPromise.then(() =>
                            // get the full record with all its files
                            store.record
                                .get(record.instanceId)
                                .then((record) => {
                                    const failedFiles = [];
                                    let folderMeta;
                                    folderName = `${name}_${_formatDate(
                                        record.created
                                    )}`;
                                    // create folder
                                    folder = zip.folder(folderName);
                                    // add XML file to folder
                                    folder.file(
                                        'submission.xml',
                                        `<?xml version="1.0" ?>\n${record.xml}`,
                                        {
                                            date: new Date(record.updated),
                                        }
                                    );
                                    folderMeta = {
                                        folder: folderName,
                                        draft: record.draft,
                                        'local name': record.name,
                                        instanceID: record.instanceId,
                                    };
                                    // add media files to folder
                                    record.files.forEach((file) => {
                                        tasks.push(
                                            utils
                                                .blobToArrayBuffer(file.item)
                                                .then((arrayBuffer) => {
                                                    // It's unfortunate we have to do this conversion.
                                                    // In the future JSZip will probably support Blobs directly.
                                                    folder.file(
                                                        file.name,
                                                        arrayBuffer
                                                    );
                                                })
                                                .catch((error) => {
                                                    // Don't let failing files prevent export from being created.
                                                    console.error(error);
                                                    failedFiles.push(file.name);
                                                    failures.push(
                                                        `Failed to retrieve ${file.name} for record "${record.name}".`
                                                    );
                                                })
                                        );
                                    });

                                    return Promise.all(tasks).then(() => {
                                        if (failedFiles.length > 0) {
                                            folderMeta['failed files'] =
                                                failedFiles;
                                        }
                                        meta.push(folderMeta);
                                    });
                                })
                        ),
                    Promise.resolve()
                )
        )
        .then(() => {
            zip.file('meta.json', JSON.stringify(meta, null, 4));

            return zip.generateAsync({
                type: 'blob',
            });
        })
        .then((blob) => {
            let error;

            blob.name = `${name}_${_formatDate(new Date())}.zip`;
            if (failures.length > 0) {
                error = new Error(
                    `<ul class="error-list"><li>${failures.join(
                        '</li><li>'
                    )}</li></ul>`
                );
                error.exportFile = blob;
                throw error;
            } else {
                return blob;
            }
        });
}

function _formatDate(date) {
    const d = new Date(date);

    if (d.toString() === 'Invalid Date') {
        return `unknown${Math.floor(Math.random() * 10000)}`;
    }

    return `${d.getFullYear()}-${_pad(d.getMonth() + 1, 2)}-${_pad(
        d.getDate(),
        2
    )}_${_pad(d.getHours(), 2)}-${_pad(d.getMinutes(), 2)}-${_pad(
        d.getSeconds(),
        2
    )}`;
}

function _pad(num, l) {
    let j;
    let str = num.toString();
    const zeros = l - str.length;

    for (j = 0; j < zeros; j++) {
        str = `0${str}`;
    }

    return str;
}

export default {
    recordsToZip,
};
