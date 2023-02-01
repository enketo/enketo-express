import {
    replaceMediaSources,
    replaceModelMediaSources,
} from '../../public/js/src/module/media';

describe('Media replacement', () => {
    const parser = new DOMParser();
    const media = {
        'an%20image.jpg':
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/an%20image.jpg',
        'a%20song.mp3':
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/a%20song.mp3',
        'a%20spreadsheet.csv':
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/a%20spreadsheet.csv',
        'form_logo.png':
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/form_logo.png',
    };

    /** @type {import('sinon').SinonSandbox} */
    let sandbox;

    /** @type {HTMLFormElement} */
    let formRoot;

    /** @type {Element} */
    let modelRoot;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        const formDocument = parser.parseFromString(
            /* html */ `
                <form>
                    <section class="form-logo"></section>
                    <label class="question non-select">
                        <span lang="default" class="question-label active" data-itext-id="/data/an-image:label">
                            an image
                        </span>
                        <a class="or-big-image" href="jr://images/an%20image.jpg">
                            <img lang="default" class="active" src="jr://images/an%20image.jpg" data-itext-id="/data/an-image:label" alt="image">
                        </a>
                        <input type="text" name="/data/an-image" data-type-xml="string" maxlength="2000">
                    </label>
                    <label class="question non-select ">
                        <span lang="default" class="question-label active" data-itext-id="/data/a-song:label">a song</span>
                        <audio controls="controls" lang="default" class="active" src="jr://audio/a%20song.mp3"
                            data-itext-id="/data/a-song:label">
                            Your browser does not support HTML5 audio.
                        </audio>
                        <input type="text" name="/data/a-song" data-type-xml="string" maxlength="2000">
                    </label>
                </label>
                </form>
            `,
            'text/html'
        );

        formRoot = formDocument.querySelector('form');

        const modelDocument = parser.parseFromString(
            /* xml */ `
                <model>
                    <instance>
                        <data xmlns:jr="http://openrosa.org/javarosa"
                            xmlns:odk="http://www.opendatakit.org/xforms"
                            xmlns:orx="http://openrosa.org/xforms" id="a-form">
                            <an-image src="jr://images/an%20image.jpg">jr://images/an%20image.jpg</an-image>
                            <a-song src="jr://audio/a%20song.mp3">jr://audio/a%20song.mp3</a-song>
                            <meta>
                                <instanceID/>
                            </meta>
                        </data>
                    </instance>
                    <instance id="a-spreadsheet" src="jr://files-csv/a%20spreadsheet.csv"/>
                    <instance id="last-saved" src="jr://instance/last-saved"/>
                </model>
            `,
            'text/xml'
        );

        modelRoot = modelDocument.documentElement;
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('replaces jr: URLs in a form from a media mapping', () => {
        replaceMediaSources(formRoot, media);

        const a = formRoot.querySelector('a');
        const img = formRoot.querySelector('label img');
        const audio = formRoot.querySelector('audio');

        expect(a.href).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/an%20image.jpg'
        );
        expect(img.src).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/an%20image.jpg'
        );
        expect(audio.src).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/a%20song.mp3'
        );
    });

    it('replaces jr: URLs in a form with sources swapped for offline-capable mode', () => {
        const sourceElements = formRoot.querySelectorAll('[src]');

        sourceElements.forEach((element) => {
            element.dataset.offlineSrc = element.src;
        });

        replaceMediaSources(formRoot, media);

        const img = formRoot.querySelector('label img');
        const audio = formRoot.querySelector('audio');

        expect(img.dataset.offlineSrc).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/an%20image.jpg'
        );
        expect(audio.dataset.offlineSrc).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/a%20song.mp3'
        );
    });

    it('appends a form logo if present in the media mapping', () => {
        replaceMediaSources(formRoot, media);

        const formLogo = formRoot.querySelector('.form-logo img');

        expect(formLogo.src).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/form_logo.png'
        );
    });

    it('appends a form logo with an offline source attribute if present in the media mapping', () => {
        replaceMediaSources(formRoot, media, { isOffline: true });

        const formLogo = formRoot.querySelector('.form-logo img');

        expect(formLogo.dataset.offlineSrc).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/form_logo.png'
        );
    });

    it('replaces jr: URLs in `src` attributes in a model when the `modelRoot` property is set', () => {
        const enketoForm = {
            model: {},
        };

        replaceModelMediaSources(enketoForm, media);

        enketoForm.model.rootElement = modelRoot;

        const img = modelRoot.querySelector('an-image');
        const audio = modelRoot.querySelector('a-song');
        const instance = modelRoot.querySelector('instance#a-spreadsheet');

        expect(img.getAttribute('src')).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/an%20image.jpg'
        );
        expect(audio.getAttribute('src')).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/a%20song.mp3'
        );
        expect(instance.getAttribute('src')).to.equal(
            'https://example.com/-/media/get/0/WXMDbc0H/c0f15ee04dacb1db7cc60797285ff1c8/a%20spreadsheet.csv'
        );
    });
});
