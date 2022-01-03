function _foo() { return 42; }

function bar() {
    return _foo();
}

const _quux = 10;

export const welp = 30;

const meh = [];
const hmm = true;

export { meh, hmm };

const _x = { y: 1, z: 2 };

export const { y, z } = _x;

export const [ q, r ] = [ meh, hmm ];

export default {
    bar,
    quux: _quux,
    _foo: _quux * _quux,
    _x() {},
};
