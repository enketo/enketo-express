All [\*/iframe](http://apidocs.enketo.org/v2/#post-survey-iframe) endpoints, [survey/all](http://apidocs.enketo.org/v2/#post-survey-all), and [surveys/list](http://apidocs.enketo.org/v2/#post-surveys-list) now accept a `parent_window_origin` parameter to enable an iframed webform to post messages to its parent window.

Messages currently supported are:

```
{ enketoEvent: 'submissionsuccess' }
```

and

```
{ enketoEvent: 'edited' }
```

demo: [http://enketo.github.io/enketo-iframe-demo/](http://enketo.github.io/enketo-iframe-demo/)

The returned URL contains the 'feature' (and it is not stored in Enketo's Database), so a single survey can be iframed on multiple domains by making multiple different API calls.
