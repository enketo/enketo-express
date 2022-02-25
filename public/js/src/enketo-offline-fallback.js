import settings from './module/settings';

if (
    settings.offline &&
    settings.enketoId &&
    settings.submissionParameter &&
    settings.submissionParameter.value
) {
    location.href = window.location.pathname + window.location.hash;
}
