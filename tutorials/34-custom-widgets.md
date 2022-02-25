Since version 1.53.0 it is possible to add your own widgets without forking Enketo Express by following the steps below.

### 1. Create your widget in its own repo

See [this guidance](https://enketo.github.io/enketo-core/tutorial-40-widgets.html) for creating Enketo widgets. The simplest widget has just 1 file, either: a `[NAME].js` or `[NAME].scss` file. If it has both (a common situation), make sure they have the same filename.

An example of a custom KoBoToolbox widget is [here](https://github.com/kobotoolbox/enketo-image-customization-widget).

### 2. Install your widget

After installing Enketo Express, install your custom widget "manually". A convenient way may be to use npm with a github url, e.g.

```bash
npm install https://github.com/kobotoolbox/enketo-image-customization-widget.git
```

Another way would be to publish your widget on npm.

Note that the regular `npm update production` will not update these manually installed widgets!

### 3. Add the widget to the Enketo Express installation

In your config.json `"widgets"` [configuration](https://github.com/kobotoolbox/enketo-express/tree/master/config#widgets) add your widget using the relative (to the public/js/build folder) path, e.g.

```json
{
    "widgets": [
        "note",
        "../../../node_modules/enketo-image-customization-widget/image-customization"
    ]
}
```

Use the filename without its extension in the path.
