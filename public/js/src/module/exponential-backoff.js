import records from './records-queue';

const state = {
    n: 0, // iteration
    tid: null, // currently running timeout ID
};

export function backoff() {
    if (state.n < 9) { // will result in > 5 minutes
        let offset = Math.min(2 ** state.n - 1, 300) * 1000;
        console.log(`Trying to upload again... Next attempt in: ${offset}`);
        state.n = state.n + 1;
        state.tid = setTimeout(records.uploadQueue, offset);
    }
}

export function cancelBackoff() {
    if (state.tid) {
        state.n = 0;
        clearTimeout(state.tid);
    }
}

function startBackoff() {
    state.tid = setTimeout(backoff, 0);
};
