API v2 Changes
=================


This is a temporary document with quick notes on the changes of API v2 with API v1 until these can be turned into proper documentation at some point.


# /survey endpoint
In API v2 this always returns an **online-only** webform!

# the new /survey/offline endpoint (doesn't exist in API v1)
In API v2 this always returns an **offline-enabled** webform (if offline capability is enabled in config) as the value for offline_url. If offline capability is disabled this endpoint will return a 405 Not Allowed.

# defaults
All /survey/* endpoints, except /survey/offline, now accept `defaults[]` parameters to dynamically set form defaults.
```
curl --user APIKEY: -d "server_url=https://ona.io/enketo&form_id=widgets&defaults[/widgets/text_widgets/my_string]=Hey Mark&defaults[/widgets/number_widgets/my_distress]=4" http://enk.to/api/v2/survey```
```
The returned URL contains the 'feature' (and not the Database), so a single survey can be served with different default to different users.


# postMessage
All */iframe views now accept a `parent_window_origin` parameter to enable an iframed webform to post messages to its parent window.

Messages currently supported are:

```
{ enketoEvent: 'submissionsuccess' }
```

and 

```
{ enketoEvent: 'edited' } 
```

demo: http://enketo.github.io/enketo-iframe-demo/

The returned URL contains the 'feature' (and not the Database), so a single survey can be iframed on multiple domains by making multiple different API calls.


# theme-swapping

All /survey/* endpoints now accept a `theme` parameter that will set the survey theme (centrally, in the db, for all subsequent users of that survey). If a theme has already been defined in the form definition, the API call will override it. If the theme is not supported in Enketo it is still 200/201 accepted (accepts any string). In that case the form will just load with the default theme.

Use the theme without the theme- prefix. E.g. for theme-grid, use the value "grid".

To clear a theme from the database, send an empty theme parameter.


# Documentation needs to make a distinction between:

* persistent/global survey property that affects all users of this survey
* non-persisten/individual user property that affects only those users that use the returned URL
