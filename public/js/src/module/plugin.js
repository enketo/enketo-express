import $ from 'jquery';

// plugin to select the first word(s) of a string and capitalize it
$.fn.capitalizeStart = function (numWords) {
    if (!numWords) {
        numWords = 1;
    }
    const node = this.contents()
        .filter(function () {
            return this.nodeType === 3;
        })
        .first();
    const text = node.text();
    const first = text.split(' ', numWords).join(' ');

    if (!node.length) {
        return;
    }

    node[0].nodeValue = text.slice(first.length);
    node.before(`<span class="capitalize">${first}</span>`);
};

$.fn.btnBusyState = function (busy) {
    return this.each(function () {
        const $button = $(this);
        let btnContent = $button.find('.temp').html();

        if (busy && !btnContent) {
            btnContent = $button.html();
            $button
                .empty()
                .append('<progress></progress>')
                .append(
                    $('<span class="temp" style="display: none;"/>').append(
                        btnContent
                    )
                )
                .attr('disabled', true);
        } else if (!busy && btnContent) {
            $button.empty().append(btnContent).removeAttr('disabled');
        }
    });
};

// This function facilitates changing button text regardless of its busystate.
$.fn.btnText = function (text) {
    $(this).add($(this).find('span')).last()[0].lastChild.textContent = text;
};
