/**
 * @module encryptor.spec.js
 * @description Tests encryption logic.
 * @see {SurveyEncryptionSpec}
 */

/**
 * @typedef {import('./feature/survey-encryption.spec.js')} SurveyEncryptionSpec
 */

import encryptor from '../../public/js/src/module/encryptor';

describe('Encryptor', () => {
    describe('Seed generation', () => {
        it('generates correct seed length', () => {
            const seed = new encryptor.Seed(
                'abcdefg',
                'ÛdGÆF§Dq3V*px!>XRÿ÷ëp7§'
            );
            const first = seed.getIncrementedSeedByteString();
            expect(first.length).to.equal(16);
        });

        it('correctly generates the first seed based on two constructor parameters', () => {
            const seed1 = new encryptor.Seed(
                'abcdefg',
                'ÛdGÆF§Dq3V*px!>XRÿ÷ëp7§'
            );
            const seed2 = new encryptor.Seed(
                'bbcdefg',
                'ÛdGÆF§Dq3V*px!>XRÿ÷ëp7§'
            );
            const seed3 = new encryptor.Seed(
                'bbcdefg',
                'adGÆF§Dq3V*px!>XRÿ÷ëp7§'
            );
            const first1Expected = [
                26, 165, 249, 183, 157, 87, 116, 18, 86, 100, 25, 164, 27, 112,
                192, 230,
            ];
            const first1 = seed1
                .getIncrementedSeedByteString()
                .split('')
                .map((item) => item.charCodeAt(0));
            const first2 = seed2
                .getIncrementedSeedByteString()
                .split('')
                .map((item) => item.charCodeAt(0));
            const first3 = seed3
                .getIncrementedSeedByteString()
                .split('')
                .map((item) => item.charCodeAt(0));
            expect(first1).to.deep.equal(first1Expected);
            expect(first2).to.not.deep.equal(first1Expected);
            expect(first3).to.not.deep.equal(first1Expected);

            expect(first2).to.deep.equal([
                87, 16, 237, 144, 161, 2, 179, 181, 142, 237, 206, 30, 156, 158,
                121, 243,
            ]);
            expect(first3).to.deep.equal([
                143, 141, 17, 221, 167, 138, 28, 206, 70, 192, 18, 65, 159, 235,
                40, 20,
            ]);
        });

        it('correctly increments seeds at second call', () => {
            const seed1 = new encryptor.Seed(
                'abcdefg',
                'ÛdGÆF§Dq3V*px!>XRÿ÷ëp7§'
            );
            seed1.getIncrementedSeedByteString();
            const second = seed1
                .getIncrementedSeedByteString()
                .split('')
                .map((item) => item.charCodeAt(0));
            expect(second).to.deep.equal([
                26, 166, 249, 183, 157, 87, 116, 18, 86, 100, 25, 164, 27, 112,
                192, 230,
            ]);
        });

        it('correctly generates the 20th seed', () => {
            // test for > 16 files
            const seed = new encryptor.Seed(
                'abcdefg',
                'ÛdGÆF§Dq3V*px!>XRÿ÷ëp7§'
            );
            let array;
            for (let i = 0; i < 20; i++) {
                array = seed
                    .getIncrementedSeedByteString()
                    .split('')
                    .map((item) => item.charCodeAt(0));
            }
            expect(array).to.deep.equal([
                27, 167, 251, 185, 158, 88, 117, 19, 87, 101, 26, 165, 28, 113,
                193, 231,
            ]);
        });
    });

    describe('submission encryption', () => {
        const form = {
            id: 'abc',
            version: '2',
            encryptionKey:
                'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5s9p+VdyX1ikG8nnoXLCC9hKfivAp/e1sHr3O15UQ+a8CjR/QV29+cO8zjS/KKgXZiOWvX+gDs2+5k9Kn4eQm5KhoZVw5Xla2PZtJESAd7dM9O5QrqVJ5Ukrq+kG/uV0nf6X8dxyIluNeCK1jE55J5trQMWT2SjDcj+OVoTdNGJ1H6FL+Horz2UqkIObW5/elItYF8zUZcO1meCtGwaPHxAxlvODe8JdKs3eMiIo9eTT4WbH1X+7nJ21E/FBd8EmnK/91UGOx2AayNxM0RN7pAcj47a434LzeM+XCnBztd+mtt1PSflF2CFE116ikEgLcXCj4aklfoON9TwDIQSp0wIDAQAB',
        };
        const SUBMISSION_NS = 'http://opendatakit.org/submissions';
        const XFORMS_NS = 'http://openrosa.org/xforms';

        it('generates a correct submission manifest for a simple text-only submission', (done) => {
            const record = {
                xml: '<root>this is a record</root>',
                instanceId: '1a2b',
            };

            encryptor
                .encryptRecord(form, record)
                .then((encryptedRecord) => {
                    const doc = new DOMParser().parseFromString(
                        encryptedRecord.xml,
                        'text/xml'
                    );
                    expect(doc.querySelectorAll('data').length).to.equal(1);
                    expect(doc.querySelector('data').namespaceURI).to.equal(
                        SUBMISSION_NS
                    );
                    expect(
                        doc.querySelector('data').getAttribute('id')
                    ).to.equal('abc');
                    expect(
                        doc.querySelector('data').getAttribute('version')
                    ).to.equal('2');
                    expect(
                        doc.querySelector('data').getAttribute('encrypted')
                    ).to.equal('yes');
                    expect(
                        doc.querySelectorAll('data > base64EncryptedKey').length
                    ).to.equal(1);
                    expect(
                        doc.querySelector('data > base64EncryptedKey')
                            .textContent
                    ).to.match(/.+==$/);
                    expect(
                        doc.querySelector('data > base64EncryptedKey')
                            .namespaceURI
                    ).to.equal(SUBMISSION_NS);
                    expect(doc.querySelectorAll('data > meta').length).to.equal(
                        1
                    );
                    expect(
                        doc.querySelector('data > meta').namespaceURI
                    ).to.equal(XFORMS_NS);
                    expect(
                        doc.querySelectorAll('data > meta > instanceID').length
                    ).to.equal(1);
                    expect(
                        doc.querySelector('data > meta > instanceID')
                            .textContent
                    ).to.equal('1a2b');
                    expect(
                        doc.querySelector('data > meta > instanceID')
                            .namespaceURI
                    ).to.equal(XFORMS_NS);
                    expect(
                        doc.querySelectorAll(
                            'data > base64EncryptedElementSignature'
                        ).length
                    ).to.equal(1);
                    expect(
                        doc.querySelector(
                            'data > base64EncryptedElementSignature'
                        ).textContent
                    ).to.match(/.+==$/);
                    expect(
                        doc.querySelector(
                            'data > base64EncryptedElementSignature'
                        ).namespaceURI
                    ).to.equal(SUBMISSION_NS);
                    expect(
                        doc.querySelector('data > encryptedXmlFile').textContent
                    ).to.equal('submission.xml.enc');
                    expect(
                        doc.querySelector('data >encryptedXmlFile').namespaceURI
                    ).to.equal(SUBMISSION_NS);
                    // only used by Enketo temporarily and then removed:
                    expect(
                        doc
                            .querySelector('data >encryptedXmlFile')
                            .getAttribute('type')
                    ).to.equal('file');

                    done();
                })
                .catch(done);
        });

        it('generates a correct submission manifest for a submission with (media) files', (done) => {
            const fakeImageA = new Blob(['<a id="a"><b id="b">hey!</b></a>'], {
                type: 'text/html',
            });
            fakeImageA.name = 'my-imageA.jpg';
            const fakeImageB = new Blob(['<a id="b"></a>'], {
                type: 'text/html',
            });
            fakeImageB.name = 'my-imageB.jpg';
            const record = {
                xml: '<root>this is a record</root>',
                instanceId: '1a2b',
                files: [fakeImageA, fakeImageB],
            };

            encryptor
                .encryptRecord(form, record)
                .then((encryptedRecord) => {
                    const doc = new DOMParser().parseFromString(
                        encryptedRecord.xml,
                        'text/xml'
                    );
                    expect(
                        doc.querySelectorAll('data > media').length
                    ).to.equal(2);
                    // Note, in the future, we'll put all <file> elements under 1 <media>
                    // https://github.com/opendatakit/aggregate/issues/319
                    expect(
                        doc.querySelectorAll('data > media > file').length
                    ).to.equal(2);
                    expect(
                        doc.querySelectorAll('data > media > file')[0]
                            .textContent
                    ).to.equal('my-imageA.jpg.enc');
                    expect(
                        doc.querySelectorAll('data > media > file')[1]
                            .textContent
                    ).to.equal('my-imageB.jpg.enc');
                    expect(
                        doc.querySelector('data > media > file').namespaceURI
                    ).to.equal(SUBMISSION_NS);
                    done();
                })
                .catch(done);
        });
    });
});
