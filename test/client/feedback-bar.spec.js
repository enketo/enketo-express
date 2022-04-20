import feedbackBar from '../../public/js/src/module/feedback-bar';

const parser = new DOMParser();

describe('Feedback bar', () => {
    const feedbackBarHtml = `
        <div class="alert-box warning" id="feedback-bar">
            <span class="icon icon-info-circle"></span>
            <button class="btn-icon-only close">×</button>
        </div>`;
    const showClass = 'feedback-bar--show';
    const message1 = 'message 1';
    const message2 = 'message <a href="#" title="this">2</a>';
    const message3 = 'message 3';
    let feedbackBarEl;

    before(() => {
        feedbackBarEl = parser
            .parseFromString(feedbackBarHtml, 'text/html')
            .querySelector('#feedback-bar');
        document.body.appendChild(feedbackBarEl);
    });

    after(() => {
        document.body.removeChild(document.querySelector('#feedback-bar'));
    });

    afterEach(() => {
        feedbackBar.hide();
    });

    describe('in its original state', () => {
        it('is not shown', () => {
            expect(feedbackBarEl.classList.contains(showClass)).to.equal(false);
        });
        it('is revealed when adding a message', () => {
            feedbackBar.show(message1);
            const messageEls = feedbackBarEl.querySelectorAll('p');

            expect(feedbackBarEl.classList.contains(showClass)).to.equal(true);
            expect(messageEls.length).to.equal(1);
            expect(messageEls[0].innerHTML).to.equal(message1);
        });
    });

    describe('when messages are already shown', () => {
        it('adds a new message before an already added message', () => {
            feedbackBar.show(message1);
            feedbackBar.show(message2);
            const messageEls = feedbackBarEl.querySelectorAll('p');

            expect(feedbackBarEl.classList.contains(showClass)).to.equal(true);
            expect(messageEls.length).to.equal(2);
            expect(messageEls[0].innerHTML).to.equal(message2);
            expect(messageEls[1].innerHTML).to.equal(message1);
        });

        it('removes the oldest message when needed to never show more than 2', () => {
            feedbackBar.show(message1);
            feedbackBar.show(message2);
            feedbackBar.show(message3);
            const messageEls = feedbackBarEl.querySelectorAll('p');

            expect(feedbackBarEl.classList.contains(showClass)).to.equal(true);
            expect(messageEls.length).to.equal(2);
            expect(messageEls[0].innerHTML).to.equal(message3);
            expect(messageEls[1].innerHTML).to.equal(message2);
        });
    });

    describe('hides messages', () => {
        it('with an optional timeout in seconds (simple)', (done) => {
            const time = 1;
            feedbackBar.show(message1, time);

            expect(feedbackBarEl.querySelectorAll('p').length).to.equal(1);
            expect(feedbackBarEl.classList.contains(showClass)).to.equal(true);
            setTimeout(() => {
                expect(feedbackBarEl.querySelectorAll('p').length).to.equal(0);
                expect(feedbackBarEl.classList.contains(showClass)).to.equal(
                    false
                );
                done();
            }, time * 1000);
        });
        it('with an optional individual timeout per message in seconds', (done) => {
            const time1 = 1;
            const time2 = 0.5;
            feedbackBar.show(message1, time1);
            feedbackBar.show(message2, time2);

            expect(feedbackBarEl.querySelectorAll('p').length).to.equal(2);
            expect(feedbackBarEl.classList.contains(showClass)).to.equal(true);

            setTimeout(() => {
                const messageEls = feedbackBarEl.querySelectorAll('p');
                expect(messageEls.length).to.equal(1);
                expect(messageEls[0].innerHTML).to.equal(message1);
                expect(feedbackBarEl.classList.contains(showClass)).to.equal(
                    true
                );
            }, time2 * 1000);

            setTimeout(() => {
                expect(feedbackBarEl.querySelectorAll('p').length).to.equal(0);
                expect(feedbackBarEl.classList.contains(showClass)).to.equal(
                    false
                );
                done();
            }, time1 * 1000);
        });
    });
});
