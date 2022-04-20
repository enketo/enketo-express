export default {
    /**
     * @return {Element}
     */
    get feedbackBar() {
        if (!this._fbBar) {
            this._fbBar = document.querySelector('#feedback-bar');
        }
        return this._fbBar;
    },
    /**
     * @return {NodeList}
     */
    get messages() {
        return this.feedbackBar.querySelectorAll('p');
    },
    setCloseHandler() {
        this.feedbackBar
            .querySelector('.close')
            .addEventListener('click', () => {
                this.hide();
            });
    },
    /**
     * Shows an unobtrusive feedback bar to the user.
     *
     * @param { string } message - message to show
     * @param {number=} duration - duration in seconds for the message to show
     */
    show(message, duration) {
        // Max 2 messages displayed
        this.feedbackBar.classList.add('feedback-bar--show');
        const { messages } = this;
        if (messages.length > 1) {
            messages[1].remove();
        }

        // If an already shown message isn't exactly the same
        if (!messages[0] || messages[0].innerHTML !== message.trim()) {
            const newMessage = document.createElement('p');
            newMessage.innerHTML = message.trim();
            this.feedbackBar.prepend(newMessage);

            // Automatically remove newly added feedback after a period
            if (duration) {
                setTimeout(() => {
                    newMessage.remove();
                    if (this.messages.length === 0) {
                        this.hide();
                    }
                }, duration * 1000);
            }
        }
    },
    /**
     * Hides and empties the feedback bar
     */
    hide() {
        this.feedbackBar.classList.remove('feedback-bar--show');
        this.messages.forEach((p) => p.remove());
    },
};
