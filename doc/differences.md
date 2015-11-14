##Differences between Enketo Express and Enketo Legacy

* :white_check_mark: Enketo Express is much easier to install
* :white_check_mark: Enketo Express has cross-browser (media) file inputs
* :white_check_mark: Enketo Express has a [multi-language](../README.md#translation) user interface
* :white_check_mark: Enketo Express displays right-to-left scripts from right-to-left
* :white_check_mark: Enketo Express has more text formatting (markdown syntax) support and across **all** labels **and hints**
* :white_check_mark: Enketo Express has better security of user credentials
* :white_check_mark: Enketo Express has support for multiple themes in *all* form views including previews 
* :white_check_mark: Enketo Express has an improved API (v2)
* :white_check_mark: Enketo Express allows overriding a form-defined theme via the API (v2) 
* :white_check_mark: Enketo Express has the ability to override default form values on launch through the API (v2)
* :white_check_mark: Enketo Express has a more advanced iframeable webform view that can communicate back to the parent window, enabled through the API (v2)
* :white_check_mark: Enketo Express has [external authentication](../README.md#authentication) support 
* :white_check_mark: Enketo Express will use the `instanceName` value defined in the XForm as the default local record name
* :white_check_mark: Enketo Express will automatically save any unsaved record in the offline-capable views to avoid loosing data
* :large_orange_diamond: Enketo Express' offline-capable forms are still experimental - **enable offline functionality only for testing and [report bugs](https://github.com/kobotoolbox/enketo-express/issues) please**
* :x: Enketo Express has missing API endpoints and corresponding views: all endpoints containing "/single" (single submission views)
* :x: Enketo Express has no export of queued records (yet)
* :x: Enketo Express has no [Formtester](https://enketo.org/formtester) app (planning to integrate this functionality in the form previews - it helps to let us know if this is important to you)
* :x: Enketo Express has no [Forms](https://enketo.org/forms) app (you do not need this)
* :white_check_mark: Enketo Express supports external CSV and XML data (for handcoded XForms or XLSForms after [this issue](https://github.com/XLSForm/pyxform/issues/30) is completed)
* :white_check_mark: Enketo Express has many bug fixes in the form engine that Enketo Legacy doesn't have.
* :white_check_mark: Enketo Express supports the pulldata() function (if Pyxform version after Sept 7th was used)
* :white_check_mark: Enketo Express is 100% JavaScript
* :white_check_mark: Enketo Express can be hosted on a local webserver
* :white_check_mark: Enketo Express includes an analog scale widget
* :white_check_mark: Enketo Express has far more helpful error messages
* :x: Enketo Express no longer supports Internet Explorer 11
