/**
 * Allows exponential backoff for uploading the submission queue.
 * This is not implemented as a generic function! uploadQueue is passed as a
 * parameter to avoid a dependency cycle.
 */

const state = {
    iteration: 0,
    timeoutID: -1,
};

/**
 * @param {(options?: { isRetry: boolean }) => Promise<boolean>} uploadQueue '
 */
export function backoff(uploadQueue) {
    // Exponentially increases to 5 minutes then relies on existing interval
    const delay = Math.min(2 ** state.iteration, 5 * 60) * 1000;

    state.iteration += 1;
    state.timeoutID = setTimeout(() => {
        uploadQueue({ isRetry: true });
    }, delay);
}

export function cancelBackoff() {
    state.iteration = 0;
    clearTimeout(state.timeoutID);
}
