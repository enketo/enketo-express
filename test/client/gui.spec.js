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

    it('does not escape HTML entities in translations', () => {
        gui.alert('&egrave;');

        dialog = document.querySelector('.vex');

        expect(dialog.innerText).to.include('è');
        expect(dialog.innerText).not.to.include('&egrave;');
    });
});
