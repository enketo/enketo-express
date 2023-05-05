import { Form } from 'enketo-core';
import connection from '../../../public/js/src/module/connection';
import settings from '../../../public/js/src/module/settings';
import { geoJSONExternalInstance } from '../../../public/js/src/module/geojson';

describe('GeoJSON external secondary instances', () => {
    const fixtureBasePath = '/base/test/fixtures/geojson/';

    /**
     * @param {string} fileName
     */
    const loadFixture = async (fileName) => {
        const path = `${fixtureBasePath}${fileName}`;
        const response = await fetch(path);

        if (fileName.endsWith('.geojson')) {
            return response.json();
        }

        return response.text();
    };

    const loadGeoJSONExternalInstance = async (fileName) => {
        const data = await loadFixture(fileName);

        return geoJSONExternalInstance(data);
    };

    describe('validation failures', () => {
        const failures = [
            {
                reason: 'if the data is not an object',
                source: 'not-object.geojson',
            },
            {
                reason: 'if the top-level type is not FeatureObject',
                source: 'invalid-type.geojson',
            },
            {
                reason: 'if it has no features property',
                source: 'bad-futures-collection.geojson',
            },
            {
                reason: 'if the features property is not an array',
                source: 'bad-features-not-array.geojson',
            },
            {
                reason: 'if an item in the features array does not have a type of Feature',
                source: 'bad-feature-not-feature.geojson',
            },
            {
                reason: 'if the geometry is not supported',
                source: 'feature-collection-with-unsupported-type.geojson',
            },
        ];

        failures.forEach(({ reason, source }) => {
            it(`fails to parse ${reason}`, async () => {
                const data = await loadFixture(source);

                expect(geoJSONExternalInstance.bind(null, data)).to.throw(
                    TypeError
                );
            });
        });
    });

    describe('conversion to secondary instance XML DOM', () => {
        it('ignores extra top level properties', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection-extra-toplevel.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(3);
        });

        it('accepts any top level property order', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection-toplevel-order.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(3);
        });

        it('adds geometries as children for multiple features', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection.geojson'
            );

            expect(result.documentElement.childElementCount).to.equal(3);
            expect(
                result.documentElement.children[0].querySelector('geometry')
                    .textContent
            ).to.equal('0.5 102 0 0');
            expect(
                result.documentElement.children[1].querySelector('geometry')
                    .textContent
            ).to.equal('0.5 104 0 0; 0.5 105 0 0');
            expect(
                result.documentElement.children[2].querySelector('geometry')
                    .textContent
            ).to.equal('63 5 0 0; 83 10 0 0; 63 5 0 0');
        });

        it('adds all other properties as children', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(4);
            expect(
                result.documentElement.children[0].querySelector('name')
                    .textContent
            ).to.equal('My cool point');

            expect(
                result.documentElement.children[1].childElementCount
            ).to.equal(5);
            expect(
                result.documentElement.children[1].querySelector(
                    'special-property'
                ).textContent
            ).to.equal('special value');
        });

        it('uses top level id', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection-id-toplevel.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(4);
            expect(
                result.documentElement.children[0].querySelector('id')
                    .textContent
            ).to.equal('top-level-id');
        });

        it('prioritizes top level id', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection-id-twice.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(4);
            expect(
                result.documentElement.children[0].querySelector('id')
                    .textContent
            ).to.equal('top-level-id');
        });

        it('ignores unknown top level properties', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection-extra-feature-toplevel.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(3);
            expect(
                result.documentElement.children[0].querySelector('ignored')
            ).to.equal(null);
        });

        it('adds features with no properties', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection-no-properties.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(1);
        });

        it('allows null feature property values', async () => {
            const result = await loadGeoJSONExternalInstance(
                'feature-collection-with-null.geojson'
            );

            expect(
                result.documentElement.children[0].childElementCount
            ).to.equal(4);
            expect(
                result.documentElement.children[0].querySelector('extra')
                    .textContent
            ).to.equal('');
        });
    });

    describe('integration', () => {
        const basePath = '-';
        const serverURL = 'example.com';
        const enketoId = 'external-select-geojson.xml';

        // Copied from current transformation result... there's probably a better way?
        const transformed = {
            form: '<form autocomplete="off" novalidate="novalidate" class="or clearfix" dir="ltr" data-form-id="external-select-xml-3">\n<!--This form was created by transforming an ODK/OpenRosa-flavored (X)Form using an XSL stylesheet created by Enketo LLC.--><section class="form-logo"></section><h3 dir="auto" id="form-title">GeoJSON External Secondary Instance 3</h3>\n    \n    \n        <fieldset class="question simple-select "><fieldset><legend><span lang="" class="question-label active">Question</span>\n                    </legend><div class="option-wrapper"><label class="itemset-template" data-items-path="instance(\'external-geojson\')/root/item"><input type="radio" name="/data/q" data-name="/data/q" data-type-xml="string" value=""></label><span class="itemset-labels" data-value-ref="id" data-label-ref="name">\n            </span></div></fieldset></fieldset>\n    \n</form>',
            model: '<model><instance>\n                <data id="external-select-xml-3">\n                    <q/>\n                <meta><instanceID/></meta></data>\n            </instance><instance id="external-geojson" src="/-/media/get/http/example.com/v1/projects/21/forms/external-select-xml-3/attachments/external-data.geojson"/></model>',
            theme: '',
            hash: 'md5:69c6ce51303dcb28162a125106ab93fa-49d57581af8fb1c0845746c244d05c8c-2851db799b6357cc49f5607b9000579d---1',
            languageMap: {},
        };

        /** @type {Element} */
        let modelElement;

        /** @type {HTMLElement} */
        let formElement;

        /** @type {import('sinon').SinonSandbox} */
        let sandbox;

        beforeEach(async () => {
            sandbox = sinon.createSandbox();

            if (!Object.prototype.hasOwnProperty.call(settings, 'basePath')) {
                settings.basePath = undefined;
            }

            sandbox.stub(settings, 'basePath').value(basePath);

            const nativeFetch = window.fetch;
            const transformURL = `${basePath}/transform/xform/${enketoId}`;
            const geoJSONFileName = 'external-data.geojson';
            const expectedGeoJSONRequestURL = `/${basePath}/media/get/http/${serverURL}/v1/projects/21/forms/external-select-xml-3/attachments/${geoJSONFileName}`;

            sandbox.stub(window, 'fetch').callsFake(async (url, options) => {
                if (url === transformURL) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => structuredClone(transformed),
                    };
                }

                if (url === expectedGeoJSONRequestURL) {
                    const path = `${fixtureBasePath}${geoJSONFileName}`;

                    const response = await nativeFetch(path);
                    const data = await response.json();

                    return {
                        ok: true,
                        status: 200,
                        headers: {
                            get() {},
                        },
                        json: async () => data,
                    };
                }

                return nativeFetch(url, options);
            });

            const range = document.createRange();
            const formParts = await connection.getFormParts({
                enketoId,
            });
            const formFragment = range.createContextualFragment(formParts.form);

            formElement = formFragment.firstElementChild;

            const form = new Form(formElement, {
                modelStr: formParts.model,
                external: formParts.externalData,
                survey: formParts,
            });

            form.init();

            modelElement = form.model.xml.documentElement;
        });

        afterEach(() => {
            sandbox.restore();
        });

        it('gets choices from a GeoJSON secondary instance', () => {
            const choices = formElement.querySelectorAll(
                'label:not(.itemset-template) .option-label'
            );

            expect(choices.length).to.equal(2);
            expect(choices[0].dataset.optionValue).to.equal('fs87b');
            expect(choices[0].textContent.trim()).to.equal('My cool point');
            expect(choices[1].dataset.optionValue).to.equal('67abie');
            expect(choices[1].textContent.trim()).to.equal('Your cool point');
        });

        it('populates the model with secondary instance data', () => {
            const items = [
                ...modelElement.querySelectorAll(
                    'instance[id="external-geojson"] root item'
                ),
            ];
            const geometries = items.flatMap((item) => [
                ...item.querySelectorAll('geometry'),
            ]);
            const specialProperties = items.flatMap((item) => [
                ...item.querySelectorAll('special-property'),
            ]);

            expect(geometries.length).to.equal(2);
            expect(geometries[1].textContent).to.equal('0.5 104 0 0');

            expect(specialProperties.length).to.equal(1);
            expect(specialProperties[0].parentElement).to.equal(items[1]);
            expect(specialProperties[0].textContent).to.equal('special value');
        });
    });
});
