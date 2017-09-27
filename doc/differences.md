Differences between Enketo Express and Enketo Legacy
==============

## THIS LIST IS NO LONGER UPDATED. THERE ARE MANY MORE DIFFERENCES

#### User Features

* :white_check_mark: Enketo Express webforms will not ask for browser permissions as often
* :white_check_mark: Enketo Express has cross-browser (media) file inputs
* :white_check_mark: Enketo Express has a [multi-language](../README.md#translation) user interface
* :white_check_mark: Enketo Express displays right-to-left scripts from right-to-left
* :white_check_mark: Enketo Express has more text formatting (markdown syntax) support and across **all** labels **and hints**
* :white_check_mark: Enketo Express has better security of user credentials
* :white_check_mark: Enketo Express has support for multiple themes in *all* form views including previews 
* :white_check_mark: Enketo Express will use the `instanceName` value defined in the XForm as the default local record name
* :white_check_mark: Enketo Express will automatically save any unsaved record in the offline-capable views to avoid loosing data
* :white_check_mark: Enketo Express supports the pulldata() function (if Pyxform version after Sept 7th was used)
* :white_check_mark: Enketo Express validates each page in pages mode before a user can go to the next page
* :white_check_mark: Enketo Express includes an analog scale widget
* :white_check_mark: Enketo Express has more useful cross-browser exports including media files, in the ODK format
* :x: Enketo Express has no [Formtester](https://enketo.org/formtester) app (planning to integrate this functionality in the form previews - it helps to let us know if this is important to you)
* :x: Enketo Express has no [Forms](https://enketo.org/forms) app (you do not need this)
* :white_check_mark: Enketo Express supports external CSV and XML data (for handcoded XForms or XLSForms after [this issue](https://github.com/XLSForm/pyxform/issues/30) is completed)
* :white_check_mark: Enketo Express has far more helpful error messages
* :white_check_mark: Enketo Express has support for dynamic required expressions
* :white_check_mark: Enketo Express has support for jr:requiredMsg
* :white_check_mark: Enketo Express has support for the "big-image" XForm feature

#### Developer Features
* :white_check_mark: Enketo Express has an [improved API (v2)](https://apidocs.enketo.org/v2/)
* :white_check_mark: Enketo Express allows overriding a form-defined theme via the API (v2) 
* :white_check_mark: Enketo Express has the ability to override default form values on launch through the API (v2)
* :white_check_mark: Enketo Express has a more advanced iframeable webform view that can [communicate back to the parent window](./iframe-postmessage.md), enabled through the API (v2)
* :white_check_mark: Enketo Express has [external authentication](../README.md#authentication) support 
* :x: Enketo Express has missing API endpoints and corresponding views: all endpoints containing "/single" (single submission views)
* :white_check_mark: Enketo Express is 100% JavaScript
* :white_check_mark: Enketo Express can be hosted on a local webserver
* :white_check_mark: Enketo Express can be configured with a basepath, allowing it to run on the same domain as a form/data server

#### Other
* :white_check_mark: Enketo Express is much easier to install
* :white_check_mark: Enketo Express has many bug fixes in the form engine that Enketo Legacy doesn't have

