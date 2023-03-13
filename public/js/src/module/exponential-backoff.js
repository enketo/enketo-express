/**
 * Allows exponential backoff for uploading the submission queue.
 * This is not implemented as a generic function! uploadQueue is passed as a
 * parameter to avoid a dependency cycle.
 */

const state = {
    n: 0, // iteration
    tid: null, // currently running timeout ID
};

export function backoff(uploadQueue) {
    // Exponentially increases to 5 minutes then relies on existing interval
    if (state.n < 9) {
        const offset = Math.min(2 ** state.n - 1, 5 * 60) * 1000;
        console.log(`Trying to upload again... Next attempt in: ${offset}`);
        state.n += 1;
        state.tid = setTimeout(uploadQueue, offset);
    } else {
        console.log(`Retried ${state.n} times, deferring to 5 minute interval`);
    }
}

export function cancelBackoff() {
    if (state.tid) {
        state.n = 0;
        clearTimeout(state.tid);
    }
}
