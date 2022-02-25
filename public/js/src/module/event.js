import events from 'enketo-core/src/js/event';

events.QueueSubmissionSuccess = function (detail) {
    return new CustomEvent('queuesubmissionsuccess', { detail, bubbles: true });
};

events.SubmissionSuccess = function () {
    return new CustomEvent('submissionsuccess', { bubbles: true });
};

events.Close = function () {
    return new CustomEvent('close', { bubbles: true });
};

events.OfflineLaunchCapable = function (detail) {
    return new CustomEvent('offlinelaunchcapable', { detail, bubbles: true });
};

events.ApplicationUpdated = function () {
    return new CustomEvent('applicationupdated', { bubbles: true });
};

events.FormUpdated = function () {
    return new CustomEvent('formupdated', { bubbles: true });
};

events.FormReset = function () {
    return new CustomEvent('formreset', { bubbles: true });
};

export default events;
