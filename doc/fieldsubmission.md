## Fieldsubmission Webform view

There are special fieldsubmission webform views that submit data to [OpenClinica's Fieldsubmission API](https://swaggerhub.com/api/martijnr/openclinica-fieldsubmission) instead of the regular OpenRosa Submission API.

**Make sure to enable the ['ordinals' feature](./ordinals.md) because the fieldsubmission feature requires this for forms that contain repeats.**

The following custom Enketo API endpoints return a fieldsubmission webform view:

### GET /survey/single/fieldsubmission
Only use for testing, use as [GET /survey/single](http://apidocs.enketo.org/v2/#/get-survey-single)*

### GET /survey/single/fieldsubmission/iframe 
Only use for testing, use as [GET /survey/single/iframe](http://apidocs.enketo.org/v2/#/get-survey-single-iframe)*

### POST /survey/single/fieldsubmission
Use as [POST /survey/single](http://apidocs.enketo.org/v2/#/post-survey-single)*

### POST /survey/single/fieldsubmission/iframe
Use as [POST /survey/single/iframe](http://apidocs.enketo.org/v2/#/post-survey-single-iframe)*

### POST /instance/fieldsubmission
Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines whether a _Complete_ button is present in addition to the always-present _Close_ button.
Otherwise use exactly as [POST /instance](http://apidocs.enketo.org/v2/#/post-instance)*

### POST /instance/fieldsubmission/iframe
Has an optional `complete_button` parameter which is either `"true"` or `"false"`. If omitted, considered `"false"`. This parameter determines whether a _Complete_ button is present in addition to the always-present _Close_ button.
Otherwise exactly as [POST /instance/iframe](http://apidocs.enketo.org/v2/#/post-instance-iframe)*

\* The API `defaults` request parameter is not implemented. The response property name will differ. E.g. GET /survey/single/fieldsubmission will return ‘single_fieldsubmission_url’ instead of ‘single_url’.
