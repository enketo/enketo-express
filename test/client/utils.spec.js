import utils from '../../public/js/src/module/utils';

describe('Client Utilities', () => {
    describe('CSV to XML conversion', () => {
        it('throws an error if the csv contains column headings that are not valid XML nodeNames (start with a number)', () => {
            const csv = 'a,b,c,3\n1,2,3,4';
            const convert = () => {
                utils.csvToXml(csv);
            };
            expect(convert).to.throw(Error);
            expect(convert).to.throw(
                /"3" cannot be turned into a valid XML element/
            );
        });

        it('throws an error if the csv contains column headings that are not valid XML nodeNames (start with namespace prefix)', () => {
            const csv = 'a,b,c,a:d\n1,2,3,4';
            const convert = () => {
                utils.csvToXml(csv);
            };
            expect(convert).to.throw(Error);
            expect(convert).to.throw(
                /"a:d" cannot be turned into a valid XML element/
            );
        });

        it('returns each row as an <item/> with each row item as a child element with the column heading as nodeName', () => {
            const csv = 'a,b,c,d\n1,2,3,4\n5,6,7,8';
            const xml = utils.csvToXml(csv);
            const firstItem = '<item><a>1</a><b>2</b><c>3</c><d>4</d></item>';
            const secondItem = '<item><a>5</a><b>6</b><c>7</c><d>8</d></item>';
            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                `<root>${firstItem}${secondItem}</root>`
            );
        });

        it('deals with values that contain a comma', () => {
            const csv = 'a,b,c,d\n1,2,3,"4,2"\n5,6,7,8';
            const xml = utils.csvToXml(csv);
            expect(new XMLSerializer().serializeToString(xml)).to.contain(
                '<item><a>1</a><b>2</b><c>3</c><d>4,2</d>'
            );
        });

        it('can read csv files that uses a semi-colon separator', () => {
            const csv = 'a;b;c;d\n1;2;3;"4;2"\n5;6;7;8';
            const xml = utils.csvToXml(csv);
            expect(new XMLSerializer().serializeToString(xml)).to.contain(
                '<item><a>1</a><b>2</b><c>3</c><d>4;2</d>'
            );
        });

        it('trims column headers and values', () => {
            const csv = ' a     ;b;c;d\n    1    ;2;3;4\n5;6;7;8';
            const xml = utils.csvToXml(csv);
            expect(new XMLSerializer().serializeToString(xml)).to.contain(
                '<item><a>1</a><b>2</b><c>3</c><d>4</d>'
            );
        });

        it('ignores empty lines', () => {
            const csv = ' a;b;c\n\n1;2;3\n\n5;6;7\n';
            const xml = utils.csvToXml(csv);
            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                '<root><item><a>1</a><b>2</b><c>3</c></item><item><a>5</a><b>6</b><c>7</c></item></root>'
            );
        });

        it('does not get confused by a very small csv string with \r\n linebreaks including an empty line at end', () => {
            const csv = ' a;b\r\n1;2\r\n5;6\r\n';
            const xml = utils.csvToXml(csv);
            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                '<root><item><a>1</a><b>2</b></item><item><a>5</a><b>6</b></item></root>'
            );
        });

        it('encodes XML entities', () => {
            const csv = ' a;b;c\n\na & b;2;3\n\n5;6;7\n';
            const xml = utils.csvToXml(csv);
            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                '<root><item><a>a &amp; b</a><b>2</b><c>3</c></item><item><a>5</a><b>6</b><c>7</c></item></root>'
            );
        });

        it('adds lang attributes', () => {
            const csv = 'a,b,c,d::english,d::french\n1,2,3,4,5';
            const xml = utils.csvToXml(csv);
            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                '<root><item><a>1</a><b>2</b><c>3</c><d lang="english">4</d><d lang="french">5</d></item></root>'
            );
        });

        it('adds converted lang attributes', () => {
            const csv = 'a,b,c,d::english,d::french\n1,2,3,4,5';
            const xml = utils.csvToXml(csv, {
                english: 'en',
                french: 'fr',
            });
            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                '<root><item><a>1</a><b>2</b><c>3</c><d lang="en">4</d><d lang="fr">5</d></item></root>'
            );
        });

        it('supports single-column values', () => {
            const csv = 'a\n1\n2\n3';
            const xml = utils.csvToXml(csv);

            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                '<root><item><a>1</a></item><item><a>2</a></item><item><a>3</a></item></root>'
            );
        });

        it('supports single-column values with quoted commas', () => {
            const csv = 'a\n1\n"2,3"';
            const xml = utils.csvToXml(csv);

            expect(new XMLSerializer().serializeToString(xml)).to.equal(
                '<root><item><a>1</a></item><item><a>2,3</a></item></root>'
            );
        });

        it('does not mistakenly parse invalid CSV with commas on non-header lines as a single-column', () => {
            const csv = 'a\n1,2';
            const convert = () => {
                utils.csvToXml(csv);
            };

            expect(convert).to.throw(Error);
            expect(convert).to.throw(
                /Unable to auto-detect delimiting character/
            );
        });

        [
            {
                reason: 'hyphen as the first character',
                header: '-a',
                isValid: false,
            },
            {
                reason: 'hyphens after the first character',
                header: 'a-a',
                isValid: true,
            },
            {
                reason: 'underscore as any character',
                header: '_a_a',
                isValid: true,
            },
            {
                reason: 'spaces between valid characters',
                header: 'a a',
                isValid: false,
            },
            {
                reason: 'unicode characters',
                header: 'เจมส์',
                isValid: true,
            },
        ].forEach(({ reason, header, isValid }) => {
            if (isValid) {
                it(`allows ${reason}`, () => {
                    const csv = `${header},b,c,d\n1,2,3,4\n5,6,7,8`;
                    const xml = utils.csvToXml(csv);
                    const firstItem = `<item><${header}>1</${header}><b>2</b><c>3</c><d>4</d></item>`;
                    const secondItem = `<item><${header}>5</${header}><b>6</b><c>7</c><d>8</d></item>`;

                    expect(new XMLSerializer().serializeToString(xml)).to.equal(
                        `<root>${firstItem}${secondItem}</root>`
                    );
                });
            } else {
                it(`throws for headers with ${reason}`, () => {
                    const csv = `${header},b,c,d\n1,2,3,4\n5,6,7,8`;

                    const convert = () => {
                        utils.csvToXml(csv);
                    };

                    expect(convert).to.throw(Error);
                    expect(convert).to.throw(
                        `CSV column heading "${header}" cannot be turned into a valid XML element`
                    );
                });
            }
        });
    });

    describe('blob <-> dataURI conversion', () => {
        const aBlob1 = new Blob(['<a id="a"><b id="b">hey!</b></a>'], {
            type: 'text/xml',
        });
        const aBlob1Type = aBlob1.type;
        const aBlob1Size = aBlob1.size;
        const aBlob2 = new Blob(
            ['<a id="a">将来の仏教研究は急速に発展す</a>'],
            {
                type: 'text/xml',
            }
        );
        const aBlob2Size = aBlob2.size;
        const aBlob2Type = aBlob2.type;

        it('converts a blob to a string', (done) => {
            utils.blobToDataUri(aBlob1).then((result) => {
                expect(result).to.be.a('string');
                done();
            });
        });

        it('converts a blob to dataUri and back to same blob', (done) => {
            utils
                .blobToDataUri(aBlob1)
                .then(utils.dataUriToBlob)
                .then((result) => {
                    expect(result.size).to.equal(aBlob1Size);
                    expect(result.type).to.equal(aBlob1Type);
                    expect(result).to.be.an.instanceof(Blob);
                    done();
                });
        });

        it('converts a blob cotaining Unicode to dataUri and back to same blob', (done) => {
            utils
                .blobToDataUri(aBlob2)
                .then(utils.dataUriToBlob)
                .then((result) => {
                    expect(result.size).to.equal(aBlob2Size);
                    expect(result.type).to.equal(aBlob2Type);
                    expect(result).to.be.an.instanceof(Blob);
                    done();
                });
        });

        it('fails to convert a string', (done) => {
            utils
                .blobToDataUri('a string')
                .then(utils.dataUriToBlob)
                .catch((e) => {
                    expect(e.message).to.contain('TypeError');
                    done();
                });
        });

        it('fails to convert undefined', (done) => {
            utils
                .blobToDataUri(undefined)
                .then(utils.dataUriToBlob)
                .catch((e) => {
                    expect(e.message).to.contain('TypeError');
                    done();
                });
        });

        it('fails to convert false', (done) => {
            utils
                .blobToDataUri(false)
                .then(utils.dataUriToBlob)
                .catch((e) => {
                    expect(e.message).to.contain('TypeError');
                    done();
                });
        });

        it('fails to convert null', (done) => {
            utils
                .blobToDataUri(null)
                .then(utils.dataUriToBlob)
                .catch((e) => {
                    expect(e.message).to.contain('TypeError');
                    done();
                });
        });
    });

    describe('querystring builder', () => {
        [
            // simple object
            [
                {
                    name: 'debug',
                    value: true,
                },
                '?debug=true',
            ],
            // simple array
            [
                [
                    {
                        name: 'debug',
                        value: false,
                    },
                    {
                        name: 'ecid',
                        value: 'abcd',
                    },
                ],
                '?debug=false&ecid=abcd',
            ],
            // empty results
            ['string', ''],
            [
                {
                    debug: true,
                },
                '',
            ],
            [
                {
                    name: 'ecid',
                    value: '',
                },
                '',
            ],
            [
                {
                    name: 'ecid',
                    value: undefined,
                },
                '',
            ],
            [
                {
                    name: 'ecid',
                    value: null,
                },
                '',
            ],
            [['string', {}], ''],
            [
                [
                    {
                        debug: true,
                    },
                    {
                        something: 'that',
                    },
                ],
                '',
            ],
            // encoding
            [
                {
                    name: 'ecid',
                    value: 'a value',
                },
                '?ecid=a%20value',
            ],
            // value is object
            [
                {
                    name: 'd',
                    value: {
                        '/a/b': 'c',
                        '/b/c': 'd and e',
                    },
                },
                '?d[%2Fa%2Fb]=c&d[%2Fb%2Fc]=d%20and%20e',
            ],
            // handle `%` symbol in value
            [
                {
                    name: 'd',
                    value: {
                        '/a/b': '10% tax',
                    },
                },
                '?d[%2Fa%2Fb]=10%25%20tax',
            ],
            // complex combo
            [
                [
                    {
                        name: 'ecid',
                        value: 'abcd',
                    },
                    {
                        name: 'd',
                        value: {
                            '/a/b': 'c',
                            '/b/c': 'd and e',
                        },
                    },
                ],
                '?ecid=abcd&d[%2Fa%2Fb]=c&d[%2Fb%2Fc]=d%20and%20e',
            ],
            [
                [
                    undefined,
                    {
                        name: 'ecid',
                        value: 'a',
                    },
                ],
                '?ecid=a',
            ],
        ].forEach((test) => {
            it(`generates ${test[1]} from ${JSON.stringify(
                test[0]
            )} correctly`, () => {
                expect(utils.getQueryString(test[0])).to.equal(test[1]);
            });
        });
    });

    describe('Title extractor', () => {
        [
            [
                '<html><head><title></title></head><form><h3 id="form-title">title</h3></form></html>',
                'title',
            ],
            [
                '<html><head><title></title></head><h3 id="form-title">title</h3><form></form></html>',
                'title',
            ],
            [
                '<html><head><title></title></head><form><h3 class="class" id="form-title">title</h3></form></html>',
                'title',
            ],
            [
                '<html><head><title></title></head><form><h3 data-something="something" id="form-title">title</h3></form></html>',
                'title',
            ],
            [
                '<html><head><title></title></head><form><h3 id="form-title">123, this-that :(</h3></form></html>',
                '123, this-that :(',
            ],
        ].forEach((test) => {
            it('extracts the title correctly form the form HTML string', () => {
                expect(utils.getTitleFromFormStr(test[0])).to.equal(test[1]);
            });
        });

        it('should return undefined when not getting a string input', () => {
            expect(utils.getTitleFromFormStr(123)).to.equal(undefined);
        });
    });

    describe('Theme extractor', () => {
        [
            [
                '<html><head><title></title></head><form class="theme-grid"></form></body></html>',
                'grid',
            ],
            [
                '<html><head><title></title></head><form class="theme-grid-custom"></form></html>',
                'grid-custom',
            ],
            [
                '<html><head><title></title></head><form><h3 class="class" id="form-title">title</h3></form></html>',
                null,
            ],
        ].forEach((test) => {
            it('extracts the theme correctly form the form HTML string', () => {
                expect(utils.getThemeFromFormStr(test[0])).to.equal(test[1]);
            });
        });
    });

    describe('Enketo ID determinator from location.pathname', () => {
        [
            '/abcd',
            '/abcd/',
            '/i/abcd',
            '/i/abcd/',
            '/preview/abcd',
            '/preview/abcd/',
            '/preview/i/abcd',
            '/preview/i/abcd/',
            '/single/abcd',
            '/single/abcd/',
            '/single/i/abcd',
            '/single/i/abcd/',
            '/view/abcd',
            '/view/abcd/',
            '/edit/abcd',
            '/edit/abcd/',
            '/edit/i/abcd',
            '/edit/i/abcd/',
            '/xform/abcd',
            '/xform/abcd/',
        ].forEach((test) => {
            it('extracts the id "abcd" correctly', () => {
                expect(utils.getEnketoId(test)).to.equal('abcd');
            });

            ['/preview', '/preview/'].forEach((test) => {
                it('extracts the id null correctly', () => {
                    expect(utils.getEnketoId(test)).to.equal(null);
                });
            });
        });
    });
});
