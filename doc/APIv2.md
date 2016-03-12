API v2 Changes
=================

See [https://apidocs.enketo.org/v2/](https://apidocs.enketo.org/v2/).

# postMessage
All */iframe endpoints, survey/all, and surveys/list now accept a `parent_window_origin` parameter to enable an iframed webform to post messages to its parent window.

Messages currently supported are:

```
{ enketoEvent: 'submissionsuccess' }
```

and 

```
{ enketoEvent: 'edited' } 
```

demo: http://enketo.github.io/enketo-iframe-demo/

The returned URL contains the 'feature' (and it is not stored in Enketo's Database), so a single survey can be iframed on multiple domains by making multiple different API calls.


# Documentation needs to make a distinction between:

* persistent/global survey property that affects all users of this survey
* non-persisten/individual user property that affects only those users that use the returned URL
