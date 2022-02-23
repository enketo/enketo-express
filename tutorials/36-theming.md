The default theme can be set in config/config.json. The default theme can be overridden in [the form definition](http://xlsform.org/#grid).

The recommended way to customize themes is to either:

-   Create an issue (and fund or send a pull request) for changes to the existing themes, or
-   Create your own theme in your own enketo-express port and add your custom theme in its own folder [here](https://github.com/enketo/enketo-express/blob/master/app/views/styles). No other changes are required. A succesful rebuild with `grunt`, and your theme will become active when the app starts. The advantage of using this method instead of editing the existing themes, is that you will not have merge conflicts when you update your port! Add a print-specific version of your theme and use the same filenaming convention as the built-in themes.

See also [this further guidance](https://enketo.github.io/enketo-core/tutorial-20-development.html#notes-for-css-developers).
