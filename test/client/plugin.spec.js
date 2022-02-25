import $ from 'jquery';
import '../../public/js/src/module/plugin';

describe('JQuery plugins', () => {
    describe('btnText', () => {
        it('can change the text of a button', () => {
            const $button = $('<button><i> </i>submit</button>');
            $button.btnText('save');
            expect($button[0].lastChild.textContent).to.equal('save');
        });

        it('can change the text of a button if busy state is busy during change', () => {
            const $button = $('<button><i> </i>submit</button>');
            $button.btnBusyState(true);
            $button.btnText('save');
            $button.btnBusyState(false);
            expect($button[0].lastChild.textContent).to.equal('save');
        });
    });
});
