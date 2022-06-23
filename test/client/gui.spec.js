import gui from '../../public/js/src/module/gui';

describe('Alert dialogs', () => {
    /** @type {HTMLElement | null} */
    let dialog;

    beforeEach(() => {
        dialog = null;
    });

    afterEach(() => {
        if (dialog != null) {
            const overlay = document.querySelector('.vex-overlay');

            dialog.remove();
            overlay.remove();
        }
    });

    const entities = {
        '&agrave;': 'à',
        '&eacute;': 'é',
        '&igrave;': 'ì',
        '&ograve;': 'ò',
        '&ugrave;': 'ù',
        '&Agrave;': 'À',
        '&Eacute;': 'É',
        '&Egrave;': 'È',
        '&Igrave;': 'Ì',
        '&Ograve;': 'Ò',
        '&Ugrave;': 'Ù',
    };

    Object.entries(entities).forEach(([entity, expected]) => {
        it('does not escape HTML entities in translations', () => {
            gui.alert(entity);

            dialog = document.querySelector('.vex');

            expect(dialog.innerText).to.include(expected);
            expect(dialog.innerText).not.to.include(entity);
        });
    });
});
